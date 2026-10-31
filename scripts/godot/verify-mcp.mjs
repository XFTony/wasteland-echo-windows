import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "../..");
const out = path.join(root, "output/godot-mcp-check");
fs.mkdirSync(out, {recursive:true});
const modules = path.join(root,"tools/godot-mcp/node_modules");
const { Client } = await import(pathToFileURL(path.join(modules, "@modelcontextprotocol/sdk/dist/client/index.js")));
const { StdioClientTransport } = await import(pathToFileURL(path.join(modules, "@modelcontextprotocol/sdk/dist/client/stdio.js")));
const projectPath = path.join(root, "godot");
const client = new Client({ name: "wasteland-godot-compatibility-probe", version: "1.0.0" }, { capabilities: {} });
const transport = new StdioClientTransport({ command: process.execPath,
  args: [path.join(modules, "@coding-solo/godot-mcp/build/index.js")],
  env: { ...process.env, GODOT_PATH: "D:\\Godot\\Godot_v4.7.2-stable_win64_console.exe", APPDATA: path.join(out,"godot-profile") },
  stderr: "inherit" });
const proof = { date:"2026-10-31", package:"@coding-solo/godot-mcp", version:"0.1.1", project:"godot", scope:"Read-only live MCP smoke check", calls:[] };
try {
  await client.connect(transport);
  const listed = await client.listTools();
  proof.tools = listed.tools.map(tool => tool.name);
  for (const [name, args] of [
    ["get_godot_version", {}],
    ["get_project_info", { projectPath }],
    ["get_uid", { projectPath, filePath:"scripts/game_root.gd" }]
  ]) {
    const result = await client.callTool({ name, arguments:args });
    proof.calls.push({ name, isError:Boolean(result.isError), content:result.content });
    console.log(name + ": " + (result.isError ? "FAILED" : "returned"));
    if (result.isError) throw new Error("MCP operation failed: " + name);
  }
} finally {
  await client.close();
  fs.writeFileSync(path.join(out, "mcp-probe.json"), JSON.stringify(proof,null,2) + "\n");
}
console.log(JSON.stringify({tools:proof.tools?.length,calls:proof.calls.map(c=>({name:c.name,error:c.isError}))}));
