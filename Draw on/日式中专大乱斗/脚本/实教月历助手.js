// SPDX-License-Identifier: MIT
// 新日历悬浮球脚本 v1.2.0
// 基于“备忘录悬浮球”架构重写，同时适配手机与电脑

(function () {
  "use strict";

  // ===== 默认配置 =====
  const DEFAULT_VARIABLE_ROOT_PATH = "stat_data";
  const DEFAULT_CALENDAR_KEY = "日历";
  const DEFAULT_CURRENT_TIME_PATH = "stat_data.学生证.当前时间";

  const ROOT_CONFIG_KEY = "aoo_calendar.calendar_root_path";
  const CALENDAR_KEY_CONFIG_KEY = "aoo_calendar.calendar_key";
  const TIME_CONFIG_KEY = "aoo_calendar.current_time_path";

  const INSTANCE_KEY = "__COTE_NEW_CALENDAR_FLOAT_WIDGET__";
  const ROOT_ID = "cote-new-calendar-root";
  const STYLE_ID = "cote-new-calendar-style";
  const STORAGE_PREFIX = "cote-new-calendar-pos";
  const THEME_STORAGE_PREFIX = "cote-new-calendar-theme";

  const BUCKETS = ["临时", "重复"];
  const REPEAT_RULES = ["无", "每天", "每周", "每月", "每年", "仅工作日", "仅节假日"];
  const WEEK_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

  const PANEL_WIDTH = 860;
  const PANEL_HEIGHT = 620;
  const BALL_SIZE = 48;
  const MOBILE_BREAKPOINT = 768;
  const DRAG_THRESHOLD = 6;

  const parentWindow = window.parent || window;
  const parentDocument = parentWindow.document;
  const $ = window.$;
  const _ = window._;
  const toastr = window.toastr;

  if (parentWindow[INSTANCE_KEY] && typeof parentWindow[INSTANCE_KEY].destroy === "function") {
    parentWindow[INSTANCE_KEY].destroy("reload");
  }

  if (!parentDocument || !$ || !_.get || !_.set) {
    console.error("[新日历] 缺少运行依赖：parentDocument / jQuery / lodash。");
    return;
  }

  const state = {
    open: false,
    view: "calendar",
    theme: "light",
    keyword: "",
    items: [],
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
    selectedDate: "",
    formMode: "create",
    formOrigin: null,
    destroyed: false,

    dragging: false,
    moved: false,
    suppressClick: false,
    suppressClickTimer: null,
    dragStartX: 0,
    dragStartY: 0,
    startLeft: 0,
    startTop: 0,
    left: 0,
    top: 0,

    panelDragging: false,
    panelDragStartX: 0,
    panelDragStartY: 0,
    panelStartLeft: 0,
    panelStartTop: 0,
  };

  const refs = {};
  const handlers = {};

  // ===== 基础工具 =====
  function toast(kind, message) {
    if (toastr && typeof toastr[kind] === "function") toastr[kind](message);
    else if (kind === "error") console.error("[新日历] " + message);
    else console.log("[新日历] " + message);
  }

  function escapeHtml(input) {
    return String(input == null ? "" : input)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function isObject(value) {
    return Object.prototype.toString.call(value) === "[object Object]";
  }

  function normalizeRule(rule) {
    return REPEAT_RULES.includes(rule) ? rule : "无";
  }

  function dateKey(year, month0, day) {
    return `${year}-${pad2(month0 + 1)}-${pad2(day)}`;
  }

  function keyFromDate(date) {
    return dateKey(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function endOfMonth(year, month0) {
    return new Date(year, month0 + 1, 0).getDate();
  }

  function getPoint(event) {
    if (event.touches && event.touches.length) return { x: event.touches[0].clientX, y: event.touches[0].clientY };
    if (event.changedTouches && event.changedTouches.length) return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
    return { x: event.clientX, y: event.clientY };
  }

  function getHelperFunction(name) {
    if (typeof window[name] === "function") return window[name];
    if (typeof parentWindow[name] === "function") return parentWindow[name];
    if (parentWindow.TavernHelper && typeof parentWindow.TavernHelper[name] === "function") return parentWindow.TavernHelper[name];
    return null;
  }

  function getCharacterConfigValue(key) {
    const getVariablesFn = getHelperFunction("getVariables");
    if (!getVariablesFn) return "";
    try {
      const variables = getVariablesFn({ type: "character" }) || {};
      return String(_.get(variables, key, "") || "").trim();
    } catch (error) {
      console.warn("[新日历] 读取角色卡配置失败", error);
      return "";
    }
  }

  function getVariableRootPath() {
    return getCharacterConfigValue(ROOT_CONFIG_KEY) || DEFAULT_VARIABLE_ROOT_PATH;
  }

  function getCalendarKey() {
    return getCharacterConfigValue(CALENDAR_KEY_CONFIG_KEY) || DEFAULT_CALENDAR_KEY;
  }

  function getCurrentTimePath() {
    return getCharacterConfigValue(TIME_CONFIG_KEY) || DEFAULT_CURRENT_TIME_PATH;
  }

  function getCalendarPath() {
    return `${getVariableRootPath()}.${getCalendarKey()}`;
  }

  function getDisplayCalendarPath() {
    return getCalendarPath().replace(/^stat_data\./, "");
  }

  function syncCharacterConfig() {
    const getVariablesFn = getHelperFunction("getVariables");
    const replaceVariablesFn = getHelperFunction("replaceVariables");
    if (!getVariablesFn || !replaceVariablesFn) return;

    try {
      const variables = getVariablesFn({ type: "character" }) || {};
      let changed = false;
      if (!String(_.get(variables, ROOT_CONFIG_KEY, "") || "").trim()) {
        _.set(variables, ROOT_CONFIG_KEY, DEFAULT_VARIABLE_ROOT_PATH);
        changed = true;
      }
      if (!String(_.get(variables, CALENDAR_KEY_CONFIG_KEY, "") || "").trim()) {
        _.set(variables, CALENDAR_KEY_CONFIG_KEY, DEFAULT_CALENDAR_KEY);
        changed = true;
      }
      if (!String(_.get(variables, TIME_CONFIG_KEY, "") || "").trim()) {
        _.set(variables, TIME_CONFIG_KEY, DEFAULT_CURRENT_TIME_PATH);
        changed = true;
      }
      if (changed) replaceVariablesFn(variables, { type: "character" });
    } catch (error) {
      console.warn("[新日历] 同步角色卡配置失败", error);
    }
  }

  async function ensureMvuReady() {
    if (typeof window.waitGlobalInitialized === "function") await window.waitGlobalInitialized("Mvu");
    if (!window.Mvu || typeof window.Mvu.getMvuData !== "function" || typeof window.Mvu.replaceMvuData !== "function") {
      throw new Error("Mvu 未就绪");
    }
  }

  function ensureCalendarRoot(mvuData) {
    const rootPath = getVariableRootPath();
    const calendarPath = getCalendarPath();

    if (!isObject(_.get(mvuData, rootPath))) _.set(mvuData, rootPath, {});
    if (!isObject(_.get(mvuData, calendarPath))) _.set(mvuData, calendarPath, {});

    for (const bucket of BUCKETS) {
      const bucketPath = `${calendarPath}.${bucket}`;
      if (!isObject(_.get(mvuData, bucketPath))) _.set(mvuData, bucketPath, {});
    }
  }

  async function readCalendarMap() {
    await ensureMvuReady();
    const mvuData = window.Mvu.getMvuData({ type: "message", message_id: -1 }) || {};
    ensureCalendarRoot(mvuData);
    return {
      mvuData,
      calendar: _.get(mvuData, getCalendarPath(), { 临时: {}, 重复: {} }),
    };
  }

  function getCalendarMap(mvuData) {
    ensureCalendarRoot(mvuData);
    return _.get(mvuData, getCalendarPath(), { 临时: {}, 重复: {} });
  }

  function normalizeItem(raw, id, bucket) {
    const data = isObject(raw) ? raw : {};
    return {
      id,
      bucket,
      标题: String(data.标题 == null ? "" : data.标题),
      内容: String(data.内容 == null ? "" : data.内容),
      时间: String(data.时间 == null ? "" : data.时间),
      结束时间: String(data.结束时间 == null ? "" : data.结束时间),
      重复规则: normalizeRule(String(data.重复规则 == null ? "无" : data.重复规则)),
    };
  }

  function flattenItems(calendar) {
    const result = [];
    for (const bucket of BUCKETS) {
      const map = calendar && isObject(calendar[bucket]) ? calendar[bucket] : {};
      Object.keys(map).forEach(id => result.push(normalizeItem(map[id], id, bucket)));
    }
    return result.sort((a, b) => {
      const ta = String(a.时间 || "");
      const tb = String(b.时间 || "");
      return ta.localeCompare(tb) || a.bucket.localeCompare(b.bucket) || a.标题.localeCompare(b.标题);
    });
  }

  // ===== 时间解析与重复规则（不变） =====
  function parseDateText(text, fallbackYear, fallbackMonth0) {
    const value = String(text || "").trim();
    if (!value) return null;

    let m = value.match(/(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

    m = value.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日?/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

    m = value.match(/(\d{4})年\s*-\s*(\d{1,2})月\s*-\s*(\d{1,2})日?/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

    m = value.match(/(\d{1,2})月\s*(\d{1,2})日?/);
    if (m) return new Date(fallbackYear, Number(m[1]) - 1, Number(m[2]));

    m = value.match(/(^|[^\d])(\d{1,2})日/);
    if (m) return new Date(fallbackYear, fallbackMonth0, Number(m[2]));

    return null;
  }

  function parseWeekday(text) {
    const value = String(text || "");
    const map = { 日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };

    const range = value.match(/(?:周|星期)([一二三四五六日天])\s*(?:至|到|-|—|~|～)\s*(?:周|星期)?([一二三四五六日天])/);
    if (range) {
      const start = map[range[1]];
      const end = map[range[2]];
      const out = [];
      if (start <= end) {
        for (let i = start; i <= end; i++) out.push(i);
      } else {
        for (let i = start; i <= 6; i++) out.push(i);
        for (let i = 0; i <= end; i++) out.push(i);
      }
      return out;
    }

    const matches = value.match(/(?:周|星期)([一二三四五六日天])/g);
    if (matches) return matches.map(x => map[x.replace(/周|星期/g, "")]).filter(x => x !== undefined);
    return [];
  }

  function eventOccursOn(item, date) {
    const day = startOfDay(date);
    const start = parseDateText(item.时间, state.year, state.month);
    const end = parseDateText(item.结束时间, state.year, state.month) || start;
    const rule = normalizeRule(item.重复规则);
    const weekdays = parseWeekday(item.时间);

    if (rule === "无") {
      if (!start) return false;
      const s = startOfDay(start);
      const e = end ? startOfDay(end) : s;
      return day >= s && day <= e;
    }

    if (rule === "每天") {
      if (start && day < startOfDay(start)) return false;
      if (item.结束时间 && end && day > startOfDay(end)) return false;
      return true;
    }

    if (rule === "每周") {
      if (weekdays.length) return weekdays.includes(day.getDay());
      if (!start) return false;
      return day >= startOfDay(start) && day.getDay() === start.getDay();
    }

    if (rule === "每月") {
      if (start) return day >= startOfDay(start) && day.getDate() === start.getDate();
      const m = String(item.时间 || "").match(/(\d{1,2})日/);
      return m ? day.getDate() === Number(m[1]) : false;
    }

    if (rule === "每年") {
      if (!start) return false;
      return day.getMonth() === start.getMonth() && day.getDate() === start.getDate();
    }

    if (rule === "仅工作日") {
      if (weekdays.length) return weekdays.includes(day.getDay());
      return day.getDay() >= 1 && day.getDay() <= 5;
    }

    if (rule === "仅节假日") {
      return day.getDay() === 0 || day.getDay() === 6;
    }

    return false;
  }

  function getVisibleItems() {
    const keyword = state.keyword.trim().toLowerCase();
    if (!keyword) return state.items;
    return state.items.filter(item => {
      const haystack = [item.id, item.bucket, item.标题, item.内容, item.时间, item.结束时间, item.重复规则]
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }

  function itemsForDate(date) {
    return getVisibleItems().filter(item => eventOccursOn(item, date));
  }

  function monthItems() {
    const total = endOfMonth(state.year, state.month);
    const seen = new Map();
    for (let d = 1; d <= total; d++) {
      const date = new Date(state.year, state.month, d);
      for (const item of itemsForDate(date)) {
        const key = `${item.bucket}:${item.id}`;
        if (!seen.has(key)) seen.set(key, item);
      }
    }
    return Array.from(seen.values());
  }

  function isTodayKey(key) {
    return key === keyFromDate(new Date());
  }

  // ===== 渲染 =====
  function renderItemCards(items, emptyText) {
    if (!items.length) return `<div class="cote-empty">${escapeHtml(emptyText)}</div>`;

    return items.map(item => {
      const timeLine = item.时间 ? `<p class="cote-line"><span>时间</span>${escapeHtml(item.时间)}</p>` : "";
      const endLine = item.结束时间 ? `<p class="cote-line"><span>结束</span>${escapeHtml(item.结束时间)}</p>` : "";
      const repeatLine = item.重复规则 && item.重复规则 !== "无" ? `<p class="cote-line"><span>重复</span>${escapeHtml(item.重复规则)}</p>` : "";
      const tagClass = item.bucket === "重复" ? "is-repeat" : "is-temp";

      return `
<article class="cote-card" data-id="${escapeHtml(item.id)}" data-bucket="${escapeHtml(item.bucket)}">
  <div class="cote-card-head">
    <h4>${escapeHtml(item.标题 || "(无标题)")}</h4>
    <span class="cote-tag ${tagClass}">${escapeHtml(item.bucket)}</span>
  </div>
  ${timeLine}${endLine}${repeatLine}
  <p class="cote-content">${escapeHtml(item.内容 || "").replace(/\n/g, "<br>")}</p>
  <div class="cote-actions">
    <button type="button" data-action="edit">编辑</button>
    <button type="button" class="is-danger" data-action="delete">删除</button>
  </div>
</article>`;
    }).join("");
  }

  function renderSidePanel() {
    if (!refs.dayTitle || !refs.dayList || !refs.monthList) return;

    if (!state.selectedDate) state.selectedDate = dateKey(state.year, state.month, 1);
    const parts = state.selectedDate.split("-").map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    const dayItems = itemsForDate(date);
    const mItems = monthItems();

    refs.dayTitle.textContent = `${date.getMonth() + 1}月${date.getDate()}日 周${WEEK_LABELS[date.getDay()]}`;
    refs.dayList.innerHTML = renderItemCards(dayItems, "当天没有日程");
    refs.monthList.innerHTML = renderItemCards(mItems, "本月没有日程");
  }

  function renderCalendar() {
    if (!refs.grid || !refs.monthTitle) return;

    refs.monthTitle.textContent = `${state.year}年${state.month + 1}月`;

    const first = new Date(state.year, state.month, 1);
    const startWeek = first.getDay();
    const total = endOfMonth(state.year, state.month);
    const prevTotal = endOfMonth(state.year, state.month - 1);

    let html = "";
    WEEK_LABELS.forEach(w => { html += `<div class="cote-week">${w}</div>`; });

    for (let i = 0; i < 42; i++) {
      const dayNum = i - startWeek + 1;
      let cellDate;
      let label;
      let muted = false;

      if (dayNum < 1) {
        label = prevTotal + dayNum;
        cellDate = new Date(state.year, state.month - 1, label);
        muted = true;
      } else if (dayNum > total) {
        label = dayNum - total;
        cellDate = new Date(state.year, state.month + 1, label);
        muted = true;
      } else {
        label = dayNum;
        cellDate = new Date(state.year, state.month, label);
      }

      const key = keyFromDate(cellDate);
      const dayItems = muted ? [] : itemsForDate(cellDate);
      const classes = ["cote-cell"];
      if (muted) classes.push("is-muted");
      if (key === state.selectedDate) classes.push("is-selected");
      if (isTodayKey(key)) classes.push("is-today");
      if (dayItems.length) classes.push("has-event");

      html += `<button type="button" class="${classes.join(" ")}" data-date="${key}">`;
      html += `<span class="cote-day">${label}</span>`;
      dayItems.slice(0, 3).forEach(item => {
        const cls = item.bucket === "重复" ? "is-repeat" : "is-temp";
        html += `<span class="cote-event ${cls}">${escapeHtml(item.标题 || "(无标题)")}</span>`;
      });
      if (dayItems.length > 3) html += `<span class="cote-more">+${dayItems.length - 3}</span>`;
      html += `</button>`;
    }

    refs.grid.innerHTML = html;
    renderSidePanel();
  }

  async function refreshData() {
    const result = await readCalendarMap();
    state.items = flattenItems(result.calendar);
    renderCalendar();
  }

  function showCalendarView() {
    state.view = "calendar";
    refs.root.dataset.view = "calendar";
    refs.headTitle.textContent = "日历";
    renderCalendar();
  }

  function showSettingsView() {
    state.view = "settings";
    refs.root.dataset.view = "settings";
    refs.headTitle.textContent = "设置";
    refs.settingsRootInput.value = getVariableRootPath();
    refs.settingsCalendarKeyInput.value = getCalendarKey();
    refs.settingsCalendarPath.textContent = getCalendarPath();
    refs.settingsTimePathInput.value = getCurrentTimePath();
  }

  function showFormView(mode, item) {
    state.view = "form";
    refs.root.dataset.view = "form";
    state.formMode = mode;
    state.formOrigin = item ? { id: item.id, bucket: item.bucket } : null;
    refs.headTitle.textContent = mode === "create" ? "新增日程" : "编辑日程";

    refs.formId.value = item ? item.id : "";
    refs.formBucket.value = item ? item.bucket : "临时";
    refs.formTitle.value = item ? item.标题 : "";
    refs.formContent.value = item ? item.内容 : "";
    refs.formStart.value = item ? item.时间 : (state.selectedDate ? `${state.selectedDate} 08:30` : "");
    refs.formEnd.value = item ? item.结束时间 : "";
    refs.formRule.value = item ? normalizeRule(item.重复规则) : "无";
    refs.formHint.textContent = "ID 只能使用字母、数字、下划线。推荐时间格式：2015-04-06 08:30；重复日程可写 周一至周五 08:30。";
  }

  function findItem(bucket, id) {
    return state.items.find(item => item.bucket === bucket && item.id === id);
  }

  // ===== 保存、删除、设置（不变） =====
  async function saveForm() {
    const id = refs.formId.value.trim();
    const bucket = refs.formBucket.value === "重复" ? "重复" : "临时";
    const title = refs.formTitle.value.trim();
    const content = refs.formContent.value.trim();
    const payload = {
      标题: title,
      内容: content,
      时间: refs.formStart.value.trim(),
      结束时间: refs.formEnd.value.trim(),
      重复规则: normalizeRule(refs.formRule.value),
    };

    if (!id) { toast("error", "ID 不能为空。"); refs.formId.focus(); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(id)) { toast("error", "ID 只能使用字母、数字、下划线。"); refs.formId.focus(); return; }
    if (!title) { toast("error", "标题不能为空。"); refs.formTitle.focus(); return; }
    if (!content) { toast("error", "内容不能为空。"); refs.formContent.focus(); return; }
    if (!payload.时间 && payload.重复规则 === "无") { toast("error", "无重复规则的临时日程需要填写时间。"); refs.formStart.focus(); return; }

    try {
      const data = await readCalendarMap();
      const mvuData = data.mvuData;
      const calendar = getCalendarMap(mvuData);
      for (const b of BUCKETS) if (!isObject(calendar[b])) calendar[b] = {};

      const origin = state.formOrigin;
      const exists = Object.prototype.hasOwnProperty.call(calendar[bucket], id);
      const sameOrigin = origin && origin.id === id && origin.bucket === bucket;
      if (exists && !sameOrigin) {
        toast("error", "这个 ID 已存在，请更换。");
        refs.formId.focus();
        return;
      }

      calendar[bucket][id] = payload;
      if (state.formMode === "edit" && origin && (origin.id !== id || origin.bucket !== bucket)) {
        if (calendar[origin.bucket]) delete calendar[origin.bucket][origin.id];
      }

      await window.Mvu.replaceMvuData(mvuData, { type: "message", message_id: -1 });
      toast("success", "保存成功");
      await refreshData();
      showCalendarView();
    } catch (error) {
      toast("error", "保存失败：" + error.message);
    }
  }

  async function deleteItem(bucket, id) {
    if (!parentWindow.confirm(`确认删除日程「${id}」吗？`)) return;

    try {
      const data = await readCalendarMap();
      const mvuData = data.mvuData;
      const calendar = getCalendarMap(mvuData);
      if (calendar[bucket]) delete calendar[bucket][id];
      await window.Mvu.replaceMvuData(mvuData, { type: "message", message_id: -1 });
      toast("success", "删除成功");
      await refreshData();
    } catch (error) {
      toast("error", "删除失败：" + error.message);
    }
  }

  function saveSettings() {
    const rootPath = refs.settingsRootInput.value.trim();
    const calendarKey = refs.settingsCalendarKeyInput.value.trim();
    const timePath = refs.settingsTimePathInput.value.trim();
    const getVariablesFn = getHelperFunction("getVariables");
    const replaceVariablesFn = getHelperFunction("replaceVariables");

    if (!rootPath || rootPath.startsWith(".") || rootPath.endsWith(".") || rootPath.includes("..")) {
      toast("error", "变量 root 位置格式不正确。");
      refs.settingsRootInput.focus();
      return;
    }
    if (!calendarKey || calendarKey.includes(".")) {
      toast("error", "日历字段名不能为空，也不能包含点号。");
      refs.settingsCalendarKeyInput.focus();
      return;
    }
    if (!timePath || timePath.startsWith(".") || timePath.endsWith(".") || timePath.includes("..")) {
      toast("error", "当前时间变量位置格式不正确。");
      refs.settingsTimePathInput.focus();
      return;
    }
    if (!getVariablesFn || !replaceVariablesFn) {
      toast("error", "酒馆助手变量接口不可用，无法保存设置。");
      return;
    }

    try {
      const variables = getVariablesFn({ type: "character" }) || {};
      _.set(variables, ROOT_CONFIG_KEY, rootPath);
      _.set(variables, CALENDAR_KEY_CONFIG_KEY, calendarKey);
      _.set(variables, TIME_CONFIG_KEY, timePath);
      replaceVariablesFn(variables, { type: "character" });
      showSettingsView();
      refreshData().catch(error => toast("error", "刷新失败：" + error.message));
      toast("success", "设置已保存");
    } catch (error) {
      toast("error", "保存设置失败：" + error.message);
    }
  }

  async function fillNow() {
    try {
      await ensureMvuReady();
      const variables = window.Mvu.getMvuData({ type: "message", message_id: -1 }) || {};
      refs.formStart.value = String(_.get(variables, getCurrentTimePath(), "") || "");
    } catch (error) {
      toast("error", "读取当前时间失败：" + error.message);
    }
  }

  function setMonth(delta) {
    const date = new Date(state.year, state.month + delta, 1);
    state.year = date.getFullYear();
    state.month = date.getMonth();
    state.selectedDate = dateKey(state.year, state.month, 1);
    renderCalendar();
  }

  async function goCurrentMonth() {
    let current = "";
    try {
      await ensureMvuReady();
      const data = window.Mvu.getMvuData({ type: "message", message_id: -1 }) || {};
      current = String(_.get(data, getCurrentTimePath(), "") || "");
    } catch (error) {
      // fallback to real date
    }

    const parsed = parseDateText(current, new Date().getFullYear(), new Date().getMonth()) || new Date();
    state.year = parsed.getFullYear();
    state.month = parsed.getMonth();
    state.selectedDate = keyFromDate(parsed);
    renderCalendar();
  }

  function onCardAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const card = button.closest(".cote-card");
    if (!card) return;

    const bucket = card.dataset.bucket;
    const id = card.dataset.id;
    const item = findItem(bucket, id);
    if (!item) return;

    if (button.dataset.action === "edit") showFormView("edit", item);
    if (button.dataset.action === "delete") deleteItem(bucket, id);
  }

  // ===== UI 样式 =====
  function createStyle() {
    $("#" + STYLE_ID).remove();
    $("<style>").attr("id", STYLE_ID).text(`
@import url("https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700;800&family=Noto+Serif+SC:wght@600;700&display=swap");
#${ROOT_ID}{
  --bg:#f5efe3;--panel:#fffdf8;--panel2:#f0e7d6;--line:#d9ccb3;--line2:#baa680;--text:#2b241c;--muted:#6a5e4c;--soft:#8a7b67;--accent:#8a673b;--accent2:#b48a4b;--danger:#9f4a35;--shadow:0 18px 38px rgba(71,51,28,.16);
  position:fixed;inset:0;pointer-events:none;z-index:99999;font-family:"Noto Sans SC","Microsoft YaHei",sans-serif;color:var(--text)
}
#${ROOT_ID}[data-theme="dark"]{--bg:#101317;--panel:#171b20;--panel2:#202833;--line:#2e3640;--line2:#485363;--text:#e8e3d7;--muted:#9fa6a0;--soft:#7f8790;--accent:#6f8fbd;--accent2:#83a4d3;--danger:#d28574;--shadow:0 24px 48px rgba(0,0,0,.38)}
#${ROOT_ID} button,#${ROOT_ID} input,#${ROOT_ID} textarea,#${ROOT_ID} select{font-family:inherit}
#${ROOT_ID} .cote-ball{position:fixed;width:${BALL_SIZE}px;height:${BALL_SIZE}px;border-radius:18px;border:1px solid rgba(142,110,67,.58);background:rgba(190,158,111,.62);backdrop-filter:blur(10px);box-shadow:0 12px 30px rgba(96,70,34,.16);display:grid;place-items:center;color:#fff8ea;cursor:grab;pointer-events:auto;touch-action:none;user-select:none;z-index:2;transition: opacity 0.2s;}
#${ROOT_ID}[data-theme="dark"] .cote-ball{border-color:rgba(113,140,183,.42);background:rgba(62,82,116,.56)}
#${ROOT_ID} .cote-ball:active{cursor:grabbing}
#${ROOT_ID} .cote-ball svg{width:30px;height:30px;stroke:currentColor}
#${ROOT_ID} .cote-ball.is-hidden{opacity:0;pointer-events:none}
#${ROOT_ID} .cote-panel{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%) scale(.98);width:${PANEL_WIDTH}px;height:${PANEL_HEIGHT}px;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);border-radius:22px;border:1px solid var(--line);background:var(--bg);box-shadow:var(--shadow);pointer-events:auto;display:none;opacity:0;overflow:hidden;z-index:1;transition:opacity .16s ease,transform .16s ease}
#${ROOT_ID}[data-open="true"] .cote-panel{display:flex;flex-direction:column;opacity:1;transform:translate(-50%,-50%) scale(1)}
#${ROOT_ID} .cote-head{height:58px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid var(--line);background:var(--panel2);cursor:move}
#${ROOT_ID} .cote-head-left,#${ROOT_ID} .cote-head-right{display:flex;align-items:center;gap:8px;min-width:0}
#${ROOT_ID} .cote-title{font-size:18px;font-weight:800;letter-spacing:.06em;white-space:nowrap}
#${ROOT_ID} .cote-head button,#${ROOT_ID} .cote-nav button,#${ROOT_ID} .cote-form-actions button{height:36px;border:1px solid var(--line);border-radius:11px;background:var(--panel);color:var(--text);padding:0 12px;cursor:pointer;font-weight:700}
#${ROOT_ID} .cote-back{display:none}
#${ROOT_ID}[data-view="form"] .cote-back,#${ROOT_ID}[data-view="settings"] .cote-back{display:inline-flex;align-items:center}
#${ROOT_ID} .cote-body{flex:1;min-height:0;padding:12px;background:var(--bg);display:flex}
#${ROOT_ID} .cote-calendar-view{display:none;grid-template-columns:minmax(0,560px) minmax(260px,1fr);gap:12px;width:100%;min-height:0}
#${ROOT_ID}[data-view="calendar"] .cote-calendar-view{display:grid}
#${ROOT_ID} .cote-main,#${ROOT_ID} .cote-side,#${ROOT_ID} .cote-form,#${ROOT_ID} .cote-settings{border:1px solid var(--line);border-radius:18px;background:var(--panel);min-height:0;overflow:hidden}
#${ROOT_ID} .cote-main{display:flex;flex-direction:column}
#${ROOT_ID} .cote-nav{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:center;padding:10px 12px;border-bottom:1px solid var(--line);background:var(--panel2)}
#${ROOT_ID} .cote-month-title{font-family:"Noto Serif SC",serif;font-size:30px;font-weight:700;white-space:nowrap}
#${ROOT_ID} .cote-nav-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
#${ROOT_ID} .cote-search{height:36px;width:190px;border:1px solid var(--line);border-radius:11px;background:var(--panel);color:var(--text);padding:0 10px;outline:none}
#${ROOT_ID} .cote-grid{display:grid;grid-template-columns:repeat(7,1fr);grid-auto-rows:1fr;flex:1;min-height:0;padding:0 8px 8px}
#${ROOT_ID} .cote-week{height:32px;display:grid;place-items:center;color:var(--muted);font-weight:700;border-bottom:1px dashed var(--line)}
#${ROOT_ID} .cote-cell{position:relative;border:0;border-right:1px dashed var(--line);border-bottom:1px dashed var(--line);background:transparent;color:var(--text);padding:26px 5px 5px;display:flex;flex-direction:column;gap:4px;text-align:left;cursor:pointer;overflow:hidden;min-width:0}
#${ROOT_ID} .cote-cell:nth-child(7n+7){border-right:0}
#${ROOT_ID} .cote-cell:hover{background:rgba(180,138,75,.12)}
#${ROOT_ID} .cote-cell.is-muted{opacity:.32}
#${ROOT_ID} .cote-cell.is-selected{outline:2px solid var(--accent);outline-offset:-2px;background:rgba(180,138,75,.16)}
#${ROOT_ID} .cote-cell.is-today .cote-day{background:var(--accent);color:#fff;border-radius:999px;padding:2px 8px;left:5px;top:5px}
#${ROOT_ID} .cote-day{position:absolute;left:9px;top:7px;font-weight:800;font-size:15px;line-height:1}
#${ROOT_ID} .cote-event{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border:1px solid rgba(184,146,63,.32);background:rgba(240,211,137,.7);border-radius:7px;padding:2px 6px;font-size:12px;font-weight:700;line-height:18px;color:#6b4d18}
#${ROOT_ID} .cote-event.is-repeat{background:rgba(255,248,226,.8);color:var(--muted);border-color:var(--line)}
#${ROOT_ID}[data-theme="dark"] .cote-event{color:#11151b}
#${ROOT_ID} .cote-more{font-size:11px;color:var(--muted);padding-left:4px}
#${ROOT_ID} .cote-side{display:flex;flex-direction:column}
#${ROOT_ID} .cote-side-head{padding:12px 14px;border-bottom:1px solid var(--line);background:var(--panel2)}
#${ROOT_ID} .cote-day-title{margin:0;font-family:"Noto Serif SC",serif;font-size:25px}
#${ROOT_ID} .cote-scroll{overflow:auto;padding:12px;display:grid;gap:10px;align-content:start}
#${ROOT_ID} .cote-section-label{font-weight:800;color:var(--muted);font-size:14px;margin-top:2px}
#${ROOT_ID} .cote-card{border:1px solid var(--line);border-radius:14px;background:var(--panel2);padding:10px 11px}
#${ROOT_ID} .cote-card-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
#${ROOT_ID} .cote-card h4{margin:0;font-size:14px;line-height:1.45}
#${ROOT_ID} .cote-tag{border:1px solid var(--line);border-radius:999px;padding:2px 8px;font-size:11px;color:var(--muted);background:var(--panel);white-space:nowrap}
#${ROOT_ID} .cote-tag.is-temp{color:var(--accent)}
#${ROOT_ID} .cote-line{margin:4px 0;display:flex;justify-content:space-between;gap:8px;font-size:12px;color:var(--muted)}
#${ROOT_ID} .cote-line span{color:var(--soft)}
#${ROOT_ID} .cote-content{margin:8px 0 10px;font-size:13px;line-height:1.6;max-height:80px;overflow:auto}
#${ROOT_ID} .cote-actions{display:flex;gap:8px}
#${ROOT_ID} .cote-actions button{flex:1;height:30px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--text);cursor:pointer;font-weight:700}
#${ROOT_ID} .cote-actions .is-danger{color:var(--danger)}
#${ROOT_ID} .cote-empty{border:1px dashed var(--line);border-radius:14px;padding:18px;text-align:center;color:var(--muted);background:var(--panel2)}
#${ROOT_ID} .cote-form,#${ROOT_ID} .cote-settings{display:none;width:100%;padding:14px;overflow:auto}
#${ROOT_ID}[data-view="form"] .cote-form,#${ROOT_ID}[data-view="settings"] .cote-settings{display:block}
#${ROOT_ID} .cote-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:760px;margin:0 auto}
#${ROOT_ID} .cote-field{display:grid;gap:5px}
#${ROOT_ID} .cote-field.full{grid-column:1/-1}
#${ROOT_ID} .cote-field label{font-size:12px;color:var(--muted);font-weight:700}
#${ROOT_ID} .cote-field input,#${ROOT_ID} .cote-field textarea,#${ROOT_ID} .cote-field select{border:1px solid var(--line);border-radius:11px;background:var(--panel);color:var(--text);padding:9px 10px;outline:none;font-size:13px}
#${ROOT_ID} .cote-field textarea{min-height:100px;resize:vertical}
#${ROOT_ID} .cote-path{border:1px solid var(--line);border-radius:11px;background:var(--panel2);color:var(--muted);padding:9px 10px;word-break:break-all;font-size:13px}
#${ROOT_ID} .cote-hint{grid-column:1/-1;color:var(--muted);font-size:12px;line-height:1.65}
#${ROOT_ID} .cote-form-actions{grid-column:1/-1;display:flex;gap:8px;justify-content:flex-end}
#${ROOT_ID} .cote-primary{background:var(--accent)!important;color:#fff!important;border-color:var(--accent)!important}

@media(max-width:${MOBILE_BREAKPOINT}px){
  /* 移动端悬浮球默认右下角（由 JS 控制），仅调整外观 */
  #${ROOT_ID} .cote-ball{border-radius: 50%; backdrop-filter: blur(8px);}

  /* 全屏面板 */
  #${ROOT_ID} .cote-panel{
    width:100vw; height:100dvh; max-width:none; max-height:none; border-radius:0; border:0;
    left:0; top:0; transform:none;
  }
  #${ROOT_ID}[data-open="true"] .cote-panel{transform:none; border-radius:0;}

  /* 日历视图单列 */
  #${ROOT_ID} .cote-calendar-view{grid-template-columns:1fr; grid-template-rows:minmax(380px,52vh) minmax(200px,1fr);}
  #${ROOT_ID} .cote-nav{grid-template-columns:1fr;}
  #${ROOT_ID} .cote-nav-actions{justify-content:flex-start;}
  #${ROOT_ID} .cote-search{width:100%;}

  /* 表单单列 */
  #${ROOT_ID} .cote-form-grid{grid-template-columns:1fr;}

  /* 保证按钮触摸尺寸 */
  #${ROOT_ID} .cote-head button, #${ROOT_ID} .cote-nav button, #${ROOT_ID} .cote-actions button{min-height:44px; min-width:44px;}

  /* 日历格子增加内边距 */
  #${ROOT_ID} .cote-cell{padding:28px 6px 6px;}
  #${ROOT_ID} .cote-day{font-size:14px;}
  #${ROOT_ID} .cote-week{height:28px;}
}
`).appendTo("head");
  }

  function createUI() {
    $("#" + ROOT_ID).remove();
    $("#" + STYLE_ID).remove();
    createStyle();

    const html = `
<button type="button" class="cote-ball" title="日历" aria-label="日历" aria-expanded="false">
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3.75 8.25h16.5M5.25 5.25h13.5a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-12a1.5 1.5 0 0 1 1.5-1.5Z"/></svg>
</button>
<section class="cote-panel" aria-label="日历面板">
  <header class="cote-head">
    <div class="cote-head-left"><button type="button" class="cote-back">返回</button><div class="cote-title">日历</div></div>
    <div class="cote-head-right"><button type="button" class="cote-theme">明/暗</button><button type="button" class="cote-settings-btn">设置</button><button type="button" class="cote-close">✕</button></div>
  </header>
  <div class="cote-body">
    <section class="cote-calendar-view">
      <div class="cote-main">
        <div class="cote-nav">
          <div class="cote-month-title"></div>
          <div class="cote-nav-actions">
            <input class="cote-search" placeholder="搜索日程" />
            <button type="button" data-action="prev">上个月</button>
            <button type="button" data-action="today">回到当前</button>
            <button type="button" data-action="next">下个月</button>
            <button type="button" class="cote-primary" data-action="add">＋</button>
          </div>
        </div>
        <div class="cote-grid"></div>
      </div>
      <aside class="cote-side">
        <div class="cote-side-head"><h3 class="cote-day-title"></h3></div>
        <div class="cote-scroll">
          <div class="cote-section-label">当天日程</div>
          <div class="cote-day-list"></div>
          <div class="cote-section-label">本月日程</div>
          <div class="cote-month-list"></div>
        </div>
      </aside>
    </section>

    <section class="cote-form">
      <div class="cote-form-grid">
        <div class="cote-field"><label>ID</label><input data-field="id" placeholder="例如 midterm_exam" /></div>
        <div class="cote-field"><label>分类</label><select data-field="bucket"><option value="临时">临时</option><option value="重复">重复</option></select></div>
        <div class="cote-field"><label>标题</label><input data-field="title" placeholder="日程标题" /></div>
        <div class="cote-field"><label>重复规则</label><select data-field="rule"><option value="无">无</option><option value="每天">每天</option><option value="每周">每周</option><option value="每月">每月</option><option value="每年">每年</option><option value="仅工作日">仅工作日</option><option value="仅节假日">仅节假日</option></select></div>
        <div class="cote-field"><label>开始时间</label><div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px"><input data-field="start" placeholder="2015-04-06 08:30" /><button type="button" data-action="fill-now">现在</button></div></div>
        <div class="cote-field"><label>结束时间</label><input data-field="end" placeholder="可空；跨日事件填写" /></div>
        <div class="cote-field full"><label>内容</label><textarea data-field="content" placeholder="客观描述日程、课程、约定或特别考试"></textarea></div>
        <div class="cote-hint"></div>
        <div class="cote-form-actions"><button type="button" data-action="cancel">取消</button><button type="button" class="cote-primary" data-action="save">保存</button></div>
      </div>
    </section>

    <section class="cote-settings">
      <div class="cote-form-grid">
        <div class="cote-field full"><label>变量 root 位置</label><input data-setting="root" /></div>
        <div class="cote-field full"><label>日历字段名</label><input data-setting="calendar-key" /></div>
        <div class="cote-field full"><label>实际日历位置</label><div class="cote-path" data-setting="calendar-path"></div></div>
        <div class="cote-field full"><label>当前时间变量位置</label><input data-setting="time-path" /></div>
        <div class="cote-hint">默认实际位置：stat_data.日历；推荐当前时间：stat_data.学生证.当前时间</div>
        <div class="cote-form-actions"><button type="button" data-action="cancel-settings">取消</button><button type="button" class="cote-primary" data-action="save-settings">保存设置</button></div>
      </div>
    </section>
  </div>
</section>`;

    const root = $("<div>")
      .attr("id", ROOT_ID)
      .attr("data-open", "false")
      .attr("data-view", "calendar")
      .attr("data-theme", "light")
      .html(html)
      .appendTo("body")[0];

    refs.root = root;
    refs.ball = root.querySelector(".cote-ball");
    refs.panel = root.querySelector(".cote-panel");
    refs.head = root.querySelector(".cote-head");
    refs.headTitle = root.querySelector(".cote-title");
    refs.back = root.querySelector(".cote-back");
    refs.theme = root.querySelector(".cote-theme");
    refs.settingsBtn = root.querySelector(".cote-settings-btn");
    refs.close = root.querySelector(".cote-close");
    refs.monthTitle = root.querySelector(".cote-month-title");
    refs.grid = root.querySelector(".cote-grid");
    refs.search = root.querySelector(".cote-search");
    refs.dayTitle = root.querySelector(".cote-day-title");
    refs.dayList = root.querySelector(".cote-day-list");
    refs.monthList = root.querySelector(".cote-month-list");

    refs.formId = root.querySelector('[data-field="id"]');
    refs.formBucket = root.querySelector('[data-field="bucket"]');
    refs.formTitle = root.querySelector('[data-field="title"]');
    refs.formRule = root.querySelector('[data-field="rule"]');
    refs.formStart = root.querySelector('[data-field="start"]');
    refs.formEnd = root.querySelector('[data-field="end"]');
    refs.formContent = root.querySelector('[data-field="content"]');
    refs.formHint = root.querySelector(".cote-hint");

    refs.settingsRootInput = root.querySelector('[data-setting="root"]');
    refs.settingsCalendarKeyInput = root.querySelector('[data-setting="calendar-key"]');
    refs.settingsCalendarPath = root.querySelector('[data-setting="calendar-path"]');
    refs.settingsTimePathInput = root.querySelector('[data-setting="time-path"]');
  }

  // ===== 位置、主题、拖拽 =====
  function getStorageKey(prefix) {
    const charKey = String(window.characterId || window.charName || parentWindow.characterId || parentWindow.charName || "default-char");
    const userKey = String(window.userName || parentWindow.userName || "default-user");
    return `${prefix}:${charKey}:${userKey}`;
  }

  function getViewportMetrics() {
    const viewport = parentWindow.visualViewport;
    const docEl = parentDocument.documentElement;
    return {
      width: Math.round((viewport && viewport.width) || docEl.clientWidth || parentWindow.innerWidth || 0),
      height: Math.round((viewport && viewport.height) || docEl.clientHeight || parentWindow.innerHeight || 0),
    };
  }

  function isMobile() {
    return getViewportMetrics().width <= MOBILE_BREAKPOINT;
  }

  function applyBallPosition() {
    if (!refs.ball) return;
    refs.ball.style.left = `${state.left}px`;
    refs.ball.style.top = `${state.top}px`;
  }

  function loadPosition() {
    const viewport = getViewportMetrics();
    // 移动端默认右下角，忽略本地存储
    if (isMobile()) {
      state.left = viewport.width - BALL_SIZE - 16;
      state.top = viewport.height - BALL_SIZE - 16;
    } else {
      let left = viewport.width - BALL_SIZE - 20;
      let top = Math.round(viewport.height * 0.34);
      try {
        const raw = parentWindow.localStorage.getItem(getStorageKey(STORAGE_PREFIX));
        if (raw) {
          const parsed = JSON.parse(raw);
          if (typeof parsed.left === "number") left = parsed.left;
          if (typeof parsed.top === "number") top = parsed.top;
        }
      } catch (error) { /* ignore */ }
      state.left = clamp(left, 8, Math.max(8, viewport.width - BALL_SIZE - 8));
      state.top = clamp(top, 8, Math.max(8, viewport.height - BALL_SIZE - 8));
    }
    applyBallPosition();
  }

  function savePosition() {
    if (isMobile()) return; // 移动端不保存位置
    try {
      parentWindow.localStorage.setItem(getStorageKey(STORAGE_PREFIX), JSON.stringify({ left: state.left, top: state.top }));
    } catch (error) { /* ignore */ }
  }

  function loadTheme() {
    let theme = "light";
    try {
      if (parentWindow.matchMedia && parentWindow.matchMedia("(prefers-color-scheme: dark)").matches) theme = "dark";
      const saved = parentWindow.localStorage.getItem(getStorageKey(THEME_STORAGE_PREFIX));
      if (saved === "light" || saved === "dark") theme = saved;
    } catch (error) {}
    state.theme = theme;
    applyTheme();
  }

  function applyTheme() {
    if (refs.root) refs.root.dataset.theme = state.theme;
  }

  function toggleTheme() {
    state.theme = state.theme === "light" ? "dark" : "light";
    applyTheme();
    try { parentWindow.localStorage.setItem(getStorageKey(THEME_STORAGE_PREFIX), state.theme); } catch (error) {}
  }

  function removeDragListeners() {
    $(parentDocument).off("mousemove.coteNewCalendarDrag", handlers.onDragMove);
    $(parentDocument).off("mouseup.coteNewCalendarDrag", handlers.onDragEnd);
    $(parentDocument).off("touchmove.coteNewCalendarDrag", handlers.onDragMove);
    $(parentDocument).off("touchend.coteNewCalendarDrag", handlers.onDragEnd);
    $(parentDocument).off("touchcancel.coteNewCalendarDrag", handlers.onDragCancel);
  }

  function addDragListeners() {
    $(parentDocument).on("mousemove.coteNewCalendarDrag", handlers.onDragMove);
    $(parentDocument).on("mouseup.coteNewCalendarDrag", handlers.onDragEnd);
    $(parentDocument).on("touchmove.coteNewCalendarDrag", handlers.onDragMove);
    $(parentDocument).on("touchend.coteNewCalendarDrag", handlers.onDragEnd);
    $(parentDocument).on("touchcancel.coteNewCalendarDrag", handlers.onDragCancel);
  }

  function handleResize() {
    const viewport = getViewportMetrics();
    if (isMobile()) {
      // 移动端保持右下角
      state.left = viewport.width - BALL_SIZE - 16;
      state.top = viewport.height - BALL_SIZE - 16;
    } else {
      state.left = clamp(state.left, 8, Math.max(8, viewport.width - BALL_SIZE - 8));
      state.top = clamp(state.top, 8, Math.max(8, viewport.height - BALL_SIZE - 8));
    }
    applyBallPosition();
  }

  // ===== 面板状态和事件绑定 =====
  function setPanelOpen(open) {
    state.open = !!open;
    refs.root.dataset.open = state.open ? "true" : "false";
    refs.ball.setAttribute("aria-expanded", state.open ? "true" : "false");
    // 移动端打开面板时隐藏悬浮球
    if (isMobile()) {
      refs.ball.classList.toggle("is-hidden", state.open);
    }
    if (state.open) {
      showCalendarView();
      refreshData().catch(error => toast("error", "读取日历失败：" + error.message));
    }
  }

  function bindEvents() {
    handlers.togglePanel = () => setPanelOpen(!state.open);

    handlers.onDragStart = function (event) {
      if (event.type === "mousedown" && event.button !== 0) return;
      state.dragging = true;
      state.moved = false;
      const p = getPoint(event);
      state.dragStartX = p.x;
      state.dragStartY = p.y;
      state.startLeft = state.left;
      state.startTop = state.top;
      addDragListeners();
      if (event.cancelable) event.preventDefault();
    };

    handlers.onDragMove = function (event) {
      if (!state.dragging) return;
      const p = getPoint(event);
      const dx = p.x - state.dragStartX;
      const dy = p.y - state.dragStartY;
      if (!state.moved && Math.abs(dx) <= DRAG_THRESHOLD && Math.abs(dy) <= DRAG_THRESHOLD) return;
      state.moved = true;
      const viewport = getViewportMetrics();
      state.left = clamp(state.startLeft + dx, 8, Math.max(8, viewport.width - BALL_SIZE - 8));
      state.top = clamp(state.startTop + dy, 8, Math.max(8, viewport.height - BALL_SIZE - 8));
      applyBallPosition();
      if (event.cancelable) event.preventDefault();
    };

    handlers.onDragEnd = function (event) {
      if (!state.dragging) return;
      const wasTap = !state.moved;
      const wasTouch = event && event.type === "touchend";
      if (state.moved) savePosition();
      state.dragging = false;
      removeDragListeners();
      if (wasTouch && wasTap) handlers.togglePanel();
      state.moved = false;
    };

    handlers.onDragCancel = function () {
      if (state.dragging) savePosition();
      state.dragging = false;
      state.moved = false;
      removeDragListeners();
    };

    handlers.onPanelDragMove = function (event) {
      if (!state.panelDragging || !refs.panel || isMobile()) return;
      const viewport = getViewportMetrics();
      const dx = event.clientX - state.panelDragStartX;
      const dy = event.clientY - state.panelDragStartY;
      const left = clamp(state.panelStartLeft + dx, 8, Math.max(8, viewport.width - refs.panel.offsetWidth - 8));
      const top = clamp(state.panelStartTop + dy, 8, Math.max(8, viewport.height - refs.panel.offsetHeight - 8));
      refs.panel.style.left = `${left}px`;
      refs.panel.style.top = `${top}px`;
      refs.panel.style.transform = "none";
    };

    handlers.onPanelDragEnd = function () {
      state.panelDragging = false;
      $(parentDocument).off("mousemove.coteNewCalendarPanelDrag", handlers.onPanelDragMove);
      $(parentDocument).off("mouseup.coteNewCalendarPanelDrag", handlers.onPanelDragEnd);
    };

    $(refs.ball).on("mousedown.coteNewCalendar touchstart.coteNewCalendar", handlers.onDragStart);
    $(refs.ball).on("click.coteNewCalendar", function () { if (!state.moved) handlers.togglePanel(); });

    $(refs.head).on("mousedown.coteNewCalendar", function (event) {
      if (isMobile()) return;
      if ($(event.target).closest("button,input,select,textarea,label").length || event.button !== 0) return;
      state.panelDragging = true;
      state.panelDragStartX = event.clientX;
      state.panelDragStartY = event.clientY;
      state.panelStartLeft = refs.panel.offsetLeft;
      state.panelStartTop = refs.panel.offsetTop;
      $(parentDocument).on("mousemove.coteNewCalendarPanelDrag", handlers.onPanelDragMove);
      $(parentDocument).on("mouseup.coteNewCalendarPanelDrag", handlers.onPanelDragEnd);
      event.preventDefault();
    });

    $(refs.close).on("click.coteNewCalendar", () => setPanelOpen(false));
    $(refs.theme).on("click.coteNewCalendar", toggleTheme);
    $(refs.settingsBtn).on("click.coteNewCalendar", showSettingsView);
    $(refs.back).on("click.coteNewCalendar", showCalendarView);

    $(refs.search).on("input.coteNewCalendar", function () {
      state.keyword = refs.search.value || "";
      renderCalendar();
    });

    $(refs.grid).on("click.coteNewCalendar", ".cote-cell", function () {
      const key = this.dataset.date;
      const parts = key.split("-").map(Number);
      state.year = parts[0];
      state.month = parts[1] - 1;
      state.selectedDate = key;
      renderCalendar();
    });

    $(refs.root).on("click.coteNewCalendar", "button[data-action='prev']", () => setMonth(-1));
    $(refs.root).on("click.coteNewCalendar", "button[data-action='next']", () => setMonth(1));
    $(refs.root).on("click.coteNewCalendar", "button[data-action='today']", () => goCurrentMonth());
    $(refs.root).on("click.coteNewCalendar", "button[data-action='add']", () => showFormView("create"));
    $(refs.root).on("click.coteNewCalendar", "button[data-action='save']", () => saveForm());
    $(refs.root).on("click.coteNewCalendar", "button[data-action='cancel']", showCalendarView);
    $(refs.root).on("click.coteNewCalendar", "button[data-action='fill-now']", fillNow);
    $(refs.root).on("click.coteNewCalendar", "button[data-action='cancel-settings']", showCalendarView);
    $(refs.root).on("click.coteNewCalendar", "button[data-action='save-settings']", saveSettings);

    $(refs.dayList).on("click.coteNewCalendar", onCardAction);
    $(refs.monthList).on("click.coteNewCalendar", onCardAction);

    $(parentWindow).on("resize.coteNewCalendar orientationchange.coteNewCalendar", handleResize);

    handlers.onParentUnload = function () { destroy("parent-unload"); };
    handlers.onChildUnload = function () { destroy("iframe-unload"); };
    $(parentWindow).on("beforeunload.coteNewCalendar pagehide.coteNewCalendar", handlers.onParentUnload);
    $(window).on("beforeunload.coteNewCalendar pagehide.coteNewCalendar unload.coteNewCalendar", handlers.onChildUnload);

    $(parentDocument).on("keydown.coteNewCalendar", function (event) {
      if (event.key === "Escape" && state.open) setPanelOpen(false);
    });
  }

  function destroy(reason) {
    if (state.destroyed) return;
    state.destroyed = true;
    removeDragListeners();
    $(parentWindow).off(".coteNewCalendar");
    $(window).off(".coteNewCalendar");
    $(parentDocument).off(".coteNewCalendar");
    if (refs.root) $(refs.root).off(".coteNewCalendar");
    if (refs.ball) $(refs.ball).off(".coteNewCalendar");
    if (refs.head) $(refs.head).off(".coteNewCalendar");
    if (refs.dayList) $(refs.dayList).off(".coteNewCalendar");
    if (refs.monthList) $(refs.monthList).off(".coteNewCalendar");
    $("#" + ROOT_ID).remove();
    $("#" + STYLE_ID).remove();
    if (parentWindow[INSTANCE_KEY] && parentWindow[INSTANCE_KEY].destroy === destroy) delete parentWindow[INSTANCE_KEY];
    if (reason && reason !== "reload") console.log("[新日历] 已清理：" + reason);
  }

  async function init() {
    syncCharacterConfig();
    createUI();
    bindEvents();
    loadTheme();
    loadPosition();
    await goCurrentMonth();
    try {
      await refreshData();
    } catch (error) {
      toast("error", "初始化读取失败：" + error.message);
    }
  }

  parentWindow[INSTANCE_KEY] = {
    destroy,
    open: () => setPanelOpen(true),
    close: () => setPanelOpen(false),
    reload: () => refreshData(),
  };

  init();
})();