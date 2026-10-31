# GitHub 传输配置与上传故障处理

核验日期：2026-10-27。仓库：`XFTony/wasteland-echo-windows`。这份规则补充[版本发布规则](./versioning-and-release.md)，用于源码和美术源文件的日常同步。

## 本次结论

本机已有 `github.com → ssh.github.com:443` 的 SSH 配置，已实际认证为 `XFTony`。原项目的 fetch 和 push 都使用 HTTPS，因此没有使用这条 SSH 上传通道。

根据本次实测，项目采用 **HTTPS 代理读取、SSH 443 推送**：

| 用途 | 配置 |
|---|---|
| origin 读取地址 | `https://github.com/XFTony/wasteland-echo-windows.git` |
| origin 推送地址 | `git@github.com:XFTony/wasteland-echo-windows.git` |
| SSH 实际服务器 | 现有用户配置中的 `ssh.github.com:443` |
| SSH 客户端 | 本项目固定使用 Windows OpenSSH |
| HTTPS 代理 | `http://127.0.0.1:7897`，只配置在本项目、只匹配 GitHub URL |
| HTTPS 协议 | 同样只在本项目的 GitHub URL 范围使用 HTTP/1.1 |
| SSH 连接限制 | 非交互认证、严格核验已知主机、只用配置的身份；连接超时15秒、连接尝试1次 |
| SSH 保活 | 每15秒检查一次，连续2次无响应后断开；它负责发现断链，不提供跨命令连接复用 |

普通操作仍是 `git fetch origin`、`git pull` 和 `git push`。Git 会根据用途自动选择上述地址，不需要每次手动切换远端。

这些是本机 `.git/config` 设置，**不会随着 clone 自动复制到另一台电脑**。另一台电脑应先验证自己的登录、SSH 主机指纹及代理，再配置；不要复制私钥进项目。

## 实测结果及解释

读取测试使用 `git ls-remote`，逐次核对 main 和美术分支的提交号，交错测试三种路径，每次最多等待30秒。完整记录见[连接实测](./qa/git-transport-2026-10-27.json)。

| 路径 | 本次成功耗时（秒） | 成功率 | 成功样本中位数 |
|---|---|---|---|
| Windows OpenSSH，经443端口 | 8.086、6.320、6.807 | 3/3 | 6.807秒 |
| HTTPS，显式7897代理，HTTP/1.1 | 1.417、1.450、4.536 | 3/3 | 1.450秒 |
| HTTPS，未显式配置代理 | 1.677、1.368 | 2/2 | 1.523秒 |

SSH 认证另行验证成功，配置后的推送预检也通过，耗时6.982秒。这里的读取样本不证明大文件上传吞吐量；未显式配置代理也不意味着绕过系统的 TUN/VPN。

因此不能根据协议名称断言“SSH一定更快”。本次读取选择实测较快的 HTTPS 代理；推送启用已验证的 SSH 443，提供与此前 HTTP 上传故障不同的传输通道。后续仍应观察真实推送，网络情况改变时重新评估。

## 上次耗时的真实原因

上次累计同步了43个本地提交，最终普通 Git 推送的数据包约133.28 MiB。日志包含 HTTP 408、TLS连接失败、连接重置等，不是几次认证往返就能解释的耗时。

同时，处理流程没有先测试现成的 SSH 通道，而是多次尝试整包重传、逐素材调用 Git Data API，并创建临时传输分支。最后原生 Git 仍发送了约133 MiB，说明这次逐对象预传并没有实现原先预期的最终传输量减少，反而增加了大量请求。这部分是流程问题，应避免重复。

当前最大已跟踪文件为4,269,502字节，约4.07 MiB。累计历史传输较大，不等于存在单个超大文件；本次没有引入 LFS 或改写已公开的历史。

## 日常同步规则

1. 一项可说明、可验证的工作完成后提交并推送，避免长期积攒大量未同步提交。美术源图按实际变更一起保存。
2. 先看 `git status --short --branch` 和 `git remote -v`，核实当前分支、未提交文件和推送目标。使用本次工作的开发分支。
3. 按版本规则完成相应检查；明确选择要提交的文件，不把输出截图、安装包、缓存或凭据夹带进提交。
4. 使用普通 Git 推送，显示进度；新分支用 `git push --set-upstream origin 当前分支名` 建立跟踪关系，已有跟踪关系用 `git push --progress`。
5. 推送结束后核对远端分支的提交号是否等于本地 HEAD，再报告“线上保存完成”。不要只凭“Everything up-to-date”判断成功；上次失败日志也曾附带这句话。
6. 同一通道连续出现两次相同错误后，停止整批重传，先定位认证、主机、代理或传输问题，再考虑备用通道。
7. 普通项目备份不再使用逐文件 Git Data API、临时对象树或临时传输分支。只有明确需要 API 的特殊工作才另行设计。
8. 连接超时和保活用于发现坏连接；正常大文件传输应观察进度，不能仅因超过30秒就杀掉仍在工作的推送。

## SSH 出错时怎样处理

先只读检查：

```powershell
git remote -v
git config --local --get core.sshCommand
ssh -G github.com
ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15 -T git@github.com
```

GitHub 的 SSH 认证测试成功时会显示 `Hi XFTony!`，并提示不提供 shell；此时返回码1是该测试的正常行为。普通 Git 读取和推送成功则应返回0。

若出现 `Permission denied (publickey)`，检查配置的身份或密钥代理。若主机指纹不匹配，按 GitHub 官方指纹核对，不关闭主机校验。若超时或连接重置，先检查网络路径。

需要使用 HTTPS 备用上传时，可在本项目根目录运行下面的命令。它使用已设置的本项目 GitHub 代理，不改动默认推送地址，也不创建其他托管平台的远端：

```powershell
$syncBranch = git branch --show-current
if (-not $syncBranch -or $syncBranch -eq 'main') {
    throw '请先切换到本次工作的开发分支。'
}
git -c credential.interactive=false push --progress https://github.com/XFTony/wasteland-echo-windows.git "HEAD:refs/heads/$syncBranch"
if ($LASTEXITCODE -ne 0) { throw '备用通道上传失败，请先检查实际错误。' }
git fetch origin
if ($LASTEXITCODE -ne 0) { throw '上传后未能核对远端，请继续检查连接。' }
git branch --set-upstream-to="origin/$syncBranch" "$syncBranch"
git rev-list --left-right --count 'HEAD...@{upstream}'
```

末行应为 `0 0`。备用 HTTPS 仍需要有效的本机 Git 登录；如果提示需要重新登录，处理登录后再试，不能关闭证书校验或把令牌写入 URL。

## 对 DeepSeek 建议的取舍

| 建议 | 本项目处理及理由 |
|---|---|
| 使用 SSH over 443 | 采纳为推送路径；现有配置和账号认证已验证。443承载的是SSH，不等于HTTPS。 |
| 限定作用域的 HTTPS 代理 | 采纳，并进一步限定为本项目的 GitHub URL，保留快速读取和备用上传。 |
| HTTP/1.1 | 只用于上述 HTTPS 路径；对SSH不起作用，不做全局修改。 |
| 全局 `core.compression=9` | 不采用。当前大部分体积来自已压缩图片，提高级别未必明显缩小数据包，却可能增加CPU耗时。 |
| 每次推送前 `git gc --aggressive` | 不采用。Git官方也指出它常常不值得；保留普通自动维护，必要时另做基准。 |
| `--depth=1 --filter=blob:none` | 可按需用于新的只读/临时克隆；不能直接加速现有仓库的push，不用于删减当前历史。 |
| 增大 `http.postBuffer` | 不作为常规提速设置。官方说明其主要效果是禁用分块传输，通常不能解决多数push问题，还会增加内存占用。SSH不使用它。 |
| 改hosts、第三方镜像、增加Gitee双推 | 本次不采用。它们不能替代对当前GitHub传输路径的验证，其他托管目的地应单独决定。 |
| 所有桌面工具都会读取这些配置 | 不作统一保证。使用本机Git的终端和编辑器通常会遵守；内置独立传输或认证实现的客户端需单独验证。 |

Git通常不自动采用Windows的系统HTTP代理，但仍可能使用环境变量、Git配置或系统TUN/VPN，所以“没配Git代理就永远直连”不准确。

## 本机配置与撤销

本次本项目新增的配置是：

```ini
[remote "origin"]
    url = https://github.com/XFTony/wasteland-echo-windows.git
    pushurl = git@github.com:XFTony/wasteland-echo-windows.git
[core]
    sshCommand = C:/Windows/System32/OpenSSH/ssh.exe -o BatchMode=yes -o StrictHostKeyChecking=yes -o IdentitiesOnly=yes -o ConnectTimeout=15 -o ConnectionAttempts=1 -o ServerAliveInterval=15 -o ServerAliveCountMax=2
[http "https://github.com/"]
    proxy = http://127.0.0.1:7897
    version = HTTP/1.1
```

如果将来需要撤销本次设置，在本项目根目录执行：

```powershell
git config --local --unset-all remote.origin.pushurl
git config --local --unset core.sshCommand
git config --local --unset 'http.https://github.com/.proxy'
git config --local --unset 'http.https://github.com/.version'
git remote -v
```

读取地址原本就是HTTPS，因此撤销独立pushurl后，推送也恢复为HTTPS。原用户SSH配置和其他项目的Git配置不受这组设置影响。

## 官方依据

- [GitHub：使用SSH连接443端口](https://docs.github.com/en/authentication/troubleshooting-ssh/using-ssh-over-the-https-port)
- [Git：HTTP配置与postBuffer](https://git-scm.com/docs/git-config#Documentation/git-config.txt-httppostBuffer)
- [Git：gc与aggressive选项](https://git-scm.com/docs/git-gc#_aggressive)

postBuffer与aggressive的说明也已对照本机Git 2.55.0附带的官方文档核实。
