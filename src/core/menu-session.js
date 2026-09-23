"use strict";

const { DEFAULT_KEY_BINDINGS, BINDABLE_ACTIONS, rebindKey } = require("../input/key-bindings");

class MenuSession {
  constructor(save, saveManager) {
    this.save = save;
    this.saveManager = saveManager;
    this.settingsSection = "general";
    this.pendingBindingAction = null;
    this.bindingMessage = null;
    this.shopMessage = null;
    this.inventoryPage = 0;
  }

  leaveSettings() {
    this.pendingBindingAction = null;
    this.bindingMessage = null;
  }

  setSettingsSection(section) {
    this.settingsSection = section === "controls" ? "controls" : "general";
    this.pendingBindingAction = null;
    this.bindingMessage = null;
  }

  beginKeyBinding(actionId) {
    const action = BINDABLE_ACTIONS.find((item) => item.id === actionId);
    if (!action) return false;
    this.pendingBindingAction = actionId;
    this.bindingMessage = `请按下“${action.label}”的新按键`;
    return true;
  }

  cancelKeyBinding() {
    this.pendingBindingAction = null;
    this.bindingMessage = "已取消按键修改";
  }

  applyKeyBinding(code) {
    if (!this.pendingBindingAction) return { ok: false, status: "idle" };
    const result = rebindKey(this.save.keyBindings, this.pendingBindingAction, code);
    if (result.ok) {
      this.save.keyBindings = result.bindings;
      this.pendingBindingAction = null;
      this.bindingMessage = result.status === "swapped" ? "按键冲突已自动交换" : "按键已保存";
      this.saveManager.persist();
    } else {
      this.bindingMessage = "该按键保留给菜单导航，请选择其他按键";
    }
    return result;
  }

  resetKeyBindings() {
    this.save.keyBindings = { ...DEFAULT_KEY_BINDINGS };
    this.pendingBindingAction = null;
    this.bindingMessage = "按键已恢复默认";
    this.saveManager.persist();
  }

  setInventoryPage(page) {
    const numeric = Number(page);
    this.inventoryPage = Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
  }
}

module.exports = { MenuSession };
