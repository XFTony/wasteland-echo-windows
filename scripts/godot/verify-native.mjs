import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "../..");
const project = path.join(root, "godot");
const output = path.join(root, "output/godot-migration");
const executable = process.env.GODOT_PATH || "D:/Godot/Godot_v4.7.2-stable_win64_console.exe";
fs.mkdirSync(output, {recursive:true});
const suites = [
  ["foundation", "tests/parity_test.gd", "GODOT_PARITY"],
  ["combat", "tests/combat_parity_test.gd", "GODOT_COMBAT_PARITY"],
  ["runtime", "tests/runtime_smoke_test.gd", "GODOT_RUNTIME_SMOKE"],
  ["input-audio", "tests/input_audio_test.gd", "GODOT_INPUT_AUDIO"],
  ["save-transfer", "scenes/tools/save_transfer.tscn", "GODOT_SAVE_TRANSFER", "--qa-save-transfer-test"],
  ["map-art", "tests/map_art_test.gd", "GODOT_MAP_ART"],
  ["ui-interaction", "tests/ui_interaction_test.gd", "GODOT_UI_INTERACTION"],
  ["survival-builds", "tests/survival_builds_test.gd", "GODOT_SURVIVAL_BUILDS"],
  ["fieldcraft", "tests/fieldcraft_test.gd", "GODOT_FIELDCRAFT"]
];
const reports = {};
for (const [name, script, marker, flag] of suites) {
  const entry = script.endsWith(".tscn") ? [script] : ["--script",script];
  const result = spawnSync(executable, ["--headless","--path",project,
    "--log-file",path.join(output,`${name}-engine.log`), ...entry,
    "--max-fps","60","--quit-after",name === "ui-interaction" ? "600" : "30","--",flag||"--qa-smoke"], {
    cwd:root, encoding:"utf8", windowsHide:true, timeout:60000, maxBuffer:8*1024*1024,
    env:{...process.env,APPDATA:path.join(output,"isolated-appdata")}
  });
  const log = `${result.stdout || ""}${result.stderr || ""}`;
  fs.writeFileSync(path.join(output,`${name}-check.log`),log);
  const line = log.split(/\r?\n/).find(line=>line.startsWith(marker+" "));
  const report = line ? JSON.parse(line.slice(marker.length+1)) : null;
  if (result.error || result.status !== 0 || /(?:SCRIPT ERROR|ERROR):/.test(log)
    || !report || report.failures?.length) {
    console.error(JSON.stringify({suite:name,status:result.status,error:result.error?.message,
      report,log:log.split(/\r?\n/).filter(line=>/ERROR|at:/.test(line)).slice(0,14)}));
    process.exitCode=1;break;
  }
  reports[name]=report;
  console.log(JSON.stringify({suite:name,...report}));
}
fs.writeFileSync(path.join(output,"native-checks.json"),JSON.stringify({reports,passed:!process.exitCode},null,2)+"\n");
