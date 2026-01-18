export type MeetingParams = {
  link1: string;
  id1: string;
  topic1?: string;
  link2: string;
  id2: string;
  topic2?: string;
};

type DateParts = {
  year: number;
  month: number;
  day: number;
  weekdayIndex: number;
};

type MeetingSchedule = {
  dateText: string;
  dateMonthDay: string;
  weekdayLabel: string;
  timeA: string;
  timeB: string;
};

const WEEKDAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const TIME_MORNING = { a: "09:30-10:30", b: "10:30-11:00" };
const TIME_EVENING = { a: "20:00-21:00", b: "20:30-21:30" };

const pad2 = (value: number): string => String(value).padStart(2, "0");

const getBeijingDateParts = (baseDate: Date): DateParts => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(baseDate);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);
  const weekdayIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return { year, month, day, weekdayIndex };
};

const shiftDate = (parts: DateParts, delta: number): DateParts => {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  date.setUTCDate(date.getUTCDate() + delta);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    weekdayIndex: date.getUTCDay(),
  };
};

const resolveSchedule = (baseDate: Date): MeetingSchedule => {
  const today = getBeijingDateParts(baseDate);
  const isWeekend = today.weekdayIndex === 0 || today.weekdayIndex === 6;
  const isFriday = today.weekdayIndex === 5;

  const scheduleDate = isFriday ? shiftDate(today, 1) : today;
  const timeSlot = isFriday || isWeekend ? TIME_MORNING : TIME_EVENING;

  return {
    dateText: `${scheduleDate.year}/${pad2(scheduleDate.month)}/${pad2(scheduleDate.day)}`,
    dateMonthDay: `${pad2(scheduleDate.month)}月${pad2(scheduleDate.day)}日`,
    weekdayLabel: WEEKDAY_LABELS[scheduleDate.weekdayIndex],
    timeA: timeSlot.a,
    timeB: timeSlot.b,
  };
};

export const buildMeetingNotice = (params: MeetingParams, baseDate: Date = new Date()): string => {
  const schedule = resolveSchedule(baseDate);
  const topic1 = params.topic1?.trim() || "结营&答疑";
  const topic2 = params.topic2?.trim() || "训练营结营&项目成果展示";

  return `@所有人 各位家长和同学们，大家好！
🎉 陆向谦实验室训练营${schedule.dateMonthDay}（${schedule.weekdayLabel}）时间安排如下：
📌 建议大家将本群置顶，后续所有【会议链接】和【课程通知】都会在群内发布。

⸻

📅 课程安排：

🔗 Level2&Level3会场
会议主题：${topic1} 
时间： ${schedule.dateText} ${schedule.timeA}
👉\u00A0${params.link1}
📍腾讯会议号：${params.id1}


🔗 Level3&Level4&Level5会场
会议主题：${topic2}
时间：${schedule.dateText} ${schedule.timeB}
👉\u00A0${params.link2}
📍 腾讯会议号：${params.id2}

⸻
⚠️ 注意事项：
  1.  务必使用下单时填写的手机号登录腾讯会议，否则可能无法进入会场。
  2.  建议使用**电脑（带键盘，Mac 可不配鼠标）**上课，手机或 iPad 可作辅助设备。
  3.  无法参加直播的同学可观看回放，开课前的准备材料请提前完成。如有问题请及时在群里反馈。`;
};
