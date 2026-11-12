import { QUIZ_TYPE_NAMES, QUIZ_TYPES, type QuizType } from "../core/question";
import type { QuizSettings, ScheduleSettings, Settings } from "../settings/types";
import { Check, NumberField, Row, Section, Segmented } from "./controls";
import styles from "./Settings.module.css";

interface Props {
  readonly settings: Settings;
  readonly update: (next: Settings) => unknown;
}

export function QuizTab({ settings, update }: Props) {
  const { schedule, quiz } = settings;
  const setSchedule = (patch: Partial<ScheduleSettings>) =>
    update({ ...settings, schedule: { ...schedule, ...patch } });
  const setQuiz = (patch: Partial<QuizSettings>) => update({ ...settings, quiz: { ...quiz, ...patch } });

  const toggleType = (type: QuizType, on: boolean) => {
    const enabledTypes = on
      ? QUIZ_TYPES.filter((t) => t === type || quiz.enabledTypes.includes(t))
      : quiz.enabledTypes.filter((t) => t !== type);
    setQuiz({ enabledTypes });
  };

  return (
    <>
      <Section title="弹出节奏">
        <Row label="间隔方式">
          <Segmented
            label="间隔方式"
            value={schedule.mode}
            options={[
              { value: "random", label: "随机" },
              { value: "fixed", label: "固定" },
            ]}
            onChange={(mode) => setSchedule({ mode })}
          />
        </Row>
        {schedule.mode === "random" ? (
          <Row label="间隔范围">
            <div className={styles.inline}>
              <NumberField
                label="最短间隔（分钟）"
                value={schedule.minMinutes}
                min={1}
                max={schedule.maxMinutes}
                onCommit={(minMinutes) => setSchedule({ minMinutes })}
              />
              <span>到</span>
              <NumberField
                label="最长间隔（分钟）"
                value={schedule.maxMinutes}
                min={schedule.minMinutes}
                max={480}
                onCommit={(maxMinutes) => setSchedule({ maxMinutes })}
              />
              <span>分钟</span>
            </div>
          </Row>
        ) : (
          <Row label="固定间隔">
            <div className={styles.inline}>
              <span>每</span>
              <NumberField
                label="固定间隔（分钟）"
                value={schedule.fixedMinutes}
                min={1}
                max={480}
                onCommit={(fixedMinutes) => setSchedule({ fixedMinutes })}
              />
              <span>分钟</span>
            </div>
          </Row>
        )}
        <Row
          label={
            <Check
              label="只在工作时段弹出"
              checked={schedule.workHoursEnabled}
              onChange={(workHoursEnabled) => setSchedule({ workHoursEnabled })}
            />
          }
        >
          <div className={styles.inline}>
            <input
              type="time"
              aria-label="开始时间"
              className={styles.time}
              value={schedule.workStart}
              disabled={!schedule.workHoursEnabled}
              onChange={(e) => e.target.value && setSchedule({ workStart: e.target.value })}
            />
            <span>–</span>
            <input
              type="time"
              aria-label="结束时间"
              className={styles.time}
              value={schedule.workEnd}
              disabled={!schedule.workHoursEnabled}
              onChange={(e) => e.target.value && setSchedule({ workEnd: e.target.value })}
            />
          </div>
        </Row>
        <div className={styles.inlineWide}>
          <Check
            label="全屏时不弹"
            checked={schedule.skipFullscreen}
            onChange={(skipFullscreen) => setSchedule({ skipFullscreen })}
          />
          <Check
            label="正在打字时延后"
            checked={schedule.deferWhenTyping}
            onChange={(deferWhenTyping) => setSchedule({ deferWhenTyping })}
          />
        </div>
      </Section>

      <div className={styles.divider} />

      <Section title="出题内容">
        <div className={styles.ratio}>
          <div className={styles.ratioHead}>
            <span>单词 : 句子</span>
            <strong>
              {quiz.wordRatio} : {quiz.sentenceRatio}
            </strong>
          </div>
          <input
            type="range"
            min={0}
            max={10}
            value={quiz.wordRatio}
            aria-label="单词与句子比例"
            className={styles.range}
            onChange={(e) => {
              const wordRatio = Number(e.target.value);
              setQuiz({ wordRatio, sentenceRatio: 10 - wordRatio });
            }}
          />
          <div className={styles.ratioEnds}>
            <span>全是句子</span>
            <span>全是单词</span>
          </div>
        </div>
        <div className={styles.rowLabel}>题型</div>
        <div className={styles.typeGrid}>
          {QUIZ_TYPES.map((type) => (
            <Check
              key={type}
              boxed
              label={QUIZ_TYPE_NAMES[type]}
              checked={quiz.enabledTypes.includes(type)}
              onChange={(on) => toggleType(type, on)}
            />
          ))}
        </div>
        <Row label="每天新内容上限">
          <div className={styles.inline}>
            <NumberField
              label="每天新内容上限"
              value={quiz.dailyNewLimit}
              min={0}
              max={500}
              onCommit={(dailyNewLimit) => setQuiz({ dailyNewLimit })}
            />
            <span>条</span>
          </div>
        </Row>
        <Check
          label="答题时显示首字母"
          checked={quiz.showFirstLetter}
          onChange={(showFirstLetter) => setQuiz({ showFirstLetter })}
        />
      </Section>
    </>
  );
}
