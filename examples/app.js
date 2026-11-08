import { workflows } from "./workflows.js";

const nav = document.querySelector("#workflows");
let active = workflows[0];
let framework = "vanilla";
for (const workflow of workflows) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = workflow.title;
  button.dataset.workflow = workflow.id;
  button.addEventListener("click", () => select(workflow.id, framework));
  nav.append(button);
}
function select(id, mode) {
  location.hash = `${id}/${mode}`;
}
function render() {
  const [id, mode] = location.hash.slice(1).split("/");
  active = workflows.find((workflow) => workflow.id === id) ?? workflows[0];
  framework = mode === "react" ? "react" : "vanilla";
  document.querySelector("#workflow-title").textContent = active.title;
  document.querySelector("#phase").textContent = `PHASE ${active.phase}`;
  document.querySelector("#intent").textContent = active.intent;
  document.querySelector("#contract").textContent = active.contract;
  document.querySelector("#code").textContent = active[framework];
  document.querySelector("#copy-status").textContent = "";
  for (const button of nav.children) {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.workflow === active.id),
    );
  }
  for (const button of document.querySelectorAll("[data-framework]")) {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.framework === framework),
    );
  }
}
for (const button of document.querySelectorAll("[data-framework]")) {
  button.addEventListener("click", () =>
    select(active.id, button.dataset.framework),
  );
}
document.querySelector("#copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(active[framework]);
    document.querySelector("#copy-status").textContent = "Snippet copied.";
  } catch {
    document.querySelector("#copy-status").textContent =
      "Clipboard unavailable. Select and copy the code above.";
  }
});
window.addEventListener("hashchange", render);
render();
