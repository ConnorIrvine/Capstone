# App Text Content

<!-- ================================================================
  HOW TO USE THIS FILE
  ================================================================
  This file contains every visible text string in the app, organised
  by screen. To update the text of the app:

    1. Edit only the text that appears after the colon (:) on each
       line, keeping the value within its quotes.
    2. For paragraph blocks (indented lines), edit the text inside
       the triple-backtick block.
    3. DO NOT rename or remove any [KEY] identifier — these are used
       to locate each string in the source code.
    4. Provide the edited file back to get the app updated.
  ================================================================ -->

---

## App-Wide

File: `app.json`

| Key | Element | Current Text |
|-----|---------|--------------|
| [APP_NAME] | App display name (launcher icon) | `PPGMonitor` |

---

## Welcome Screen

File: `src/screens/WelcomeScreen.tsx`

| Key | Element | Current Text |
|-----|---------|--------------|
| [WS_BTN_CONNECT] | Button — not yet connected | `Connect Device` |
| [WS_BTN_CONNECTED] | Button — already connected (dimmed) | `Device Connected` |
| [WS_BTN_START] | Button — start a session | `Start a Session` |
| [WS_BTN_HISTORY] | Button — session history | `Session History` |
| [WS_BTN_INSTRUCTIONS] | Button — instructions | `Instructions` |
| [WS_DEMO_TOGGLE] | Top-right demo mode tap target | `Demo` |
| [WS_DEV_MODE] | Footer link – developer mode | `Developer Mode` |
| [WS_ALERT_FAIL_TITLE] | Alert title — BLE connection failure | `Connection Failed` |
| [WS_ALERT_FAIL_MSG] | Alert message — BLE connection failure | `Could not connect to device.` |

---

## PPG Live Monitor Screen

File: `src/screens/PPGMonitorScreen.tsx`

| Key | Element | Current Text |
|-----|---------|--------------|
| [PPG_TITLE] | Screen header title | `PPG Live Monitor` |
| [PPG_STATUS_IDLE] | Status text — idle | `Idle` |
| [PPG_STATUS_RECORDING] | Status text — recording | `Recording...` |
| [PPG_STATUS_STOPPED] | Status text — stopped | `Stopped` |
| [PPG_API_LABEL] | Label next to API URL input | `API URL` |
| [PPG_API_PLACEHOLDER] | Placeholder inside URL input | `http://192.168.1.100:8000` |
| [PPG_INFO_DEVICE_LABEL] | Info panel label | `Device` |
| [PPG_INFO_DEVICE_VALUE] | Info panel value | `NanoESP32_PPG` |
| [PPG_INFO_RATE_LABEL] | Info panel label | `Sample Rate` |
| [PPG_INFO_RATE_VALUE] | Info panel value | `100 Hz` |
| [PPG_INFO_WINDOW_LABEL] | Info panel label | `Window` |
| [PPG_INFO_WINDOW_VALUE] | Info panel value | `600 samples` |
| [PPG_INFO_BATCH_LABEL] | Info panel label | `Batch Size` |
| [PPG_INFO_BATCH_VALUE] | Info panel value | `4 samples/pkt` |
| [PPG_BTN_STOP] | Button — while recording | `Stop Recording` |
| [PPG_BTN_START] | Button — while idle | `Start Recording` |

---

## HRV Analysis Screen

File: `src/screens/HRVScreen.tsx`

### Header & Status

| Key | Element | Current Text |
|-----|---------|--------------|
| [HRV_TITLE] | Screen header title | `HRV Analysis` |
| [HRV_STATUS_READY] | Status text — initial | `Ready` |
| [HRV_STATUS_ACTIVE] | Status text — session active | `Session active` |
| [HRV_STATUS_ENDED] | Status text — session ended normally | `Session ended` |
| [HRV_STATUS_CANCELED] | Status text — disconnected mid-session | `Session canceled` |
| [HRV_STATUS_CONN_LOST] | Status text — BLE disconnect | `Connection lost` |

### Chart & Warnings

| Key | Element | Current Text |
|-----|---------|--------------|
| [HRV_CHART_EMPTY] | Chart placeholder — no data yet | `Collecting HRV data...` |
| [HRV_SIGNAL_WARN] | Inline warning badge — signal quality issue | `Signal quality issue — recollecting 30s` |

### Session Summary Card (shown after session ends)

| Key | Element | Current Text |
|-----|---------|--------------|
| [HRV_SUM_TITLE] | Summary card title | `SESSION COMPLETE` |
| [HRV_SUM_BASELINE_LABEL] | Summary row label | `BASELINE RMSSD` |
| [HRV_SUM_FINAL_LABEL] | Summary row label | `FINAL RMSSD` |
| [HRV_SUM_IMPROVE_LABEL] | Summary row label | `IMPROVEMENT` |

### Button

| Key | Element | Current Text |
|-----|---------|--------------|
| [HRV_BTN_END] | Primary button — while recording | `End Session` |
| [HRV_BTN_START] | Primary button — when idle | `Start Session` |

### Alert Dialog (BLE disconnect)

| Key | Element | Current Text |
|-----|---------|--------------|
| [HRV_ALERT_DISC_TITLE] | Alert title | `Device disconnected` |
| [HRV_ALERT_DISC_MSG] | Alert message body | `Connection lost. Returning to the main screen. This session was not saved.` |
| [HRV_ALERT_DISC_BTN] | Alert button | `OK` |

---

## RSA Amplitude Screen

File: `src/screens/AmplitudeScreen.tsx`

### Header & Status

| Key | Element | Current Text |
|-----|---------|--------------|
| [AMP_TITLE] | Screen header title | `RSA Amplitude` |
| [AMP_STATUS_READY] | Status text — initial | `Ready` |
| [AMP_STATUS_ACTIVE] | Status text — session active | `Session active` |
| [AMP_STATUS_ENDED] | Status text — session ended normally | `Session ended` |
| [AMP_STATUS_CANCELED] | Status text — disconnected mid-session | `Session canceled` |
| [AMP_STATUS_CONN_LOST] | Status text — BLE disconnect | `Connection lost` |
| [AMP_STATUS_FAIL] | Status text — session start API failure | `Session start failed` |
| [AMP_SIGNAL_BADGE] | Signal quality badge (initial) | `ACTIVE` |

### Live Metrics Panel

| Key | Element | Current Text |
|-----|---------|--------------|
| [AMP_METRIC_HR_LABEL] | Metric box label | `HEART RATE` |
| [AMP_METRIC_HR_UNIT] | Metric unit | `bpm` |
| [AMP_METRIC_HR_EMPTY] | Placeholder when no HR value | `--` |
| [AMP_METRIC_AMP_LABEL] | Metric box label | `AMPLITUDE` |
| [AMP_METRIC_AMP_UNIT] | Amplitude unit | `BPM` |
| [AMP_METRIC_AMP_EMPTY] | Placeholder when no amplitude value | `--` |
| [AMP_METRIC_BR_LABEL] | Metric box label | `BREATHING` |
| [AMP_METRIC_BR_UNIT] | Breathing rate unit | `br/min` |
| [AMP_METRIC_BR_EMPTY] | Placeholder when no breathing rate | `--` |

### Session Summary Panel (shown after session ends)

| Key | Element | Current Text |
|-----|---------|--------------|
| [AMP_SUM_TITLE] | Summary panel title | `SESSION SUMMARY` |
| [AMP_SUM_SAMPLES] | Summary row label | `Total Samples` |
| [AMP_SUM_EVENTS] | Summary row label | `Amplitude Events` |
| [AMP_SUM_MEAN_HR] | Summary row label | `Mean HR` |
| [AMP_SUM_MIN_HR] | Summary row label | `Min HR` |
| [AMP_SUM_MAX_HR] | Summary row label | `Max HR` |
| [AMP_SUM_MEAN_AMP] | Summary row label | `Mean Amplitude` |
| [AMP_SUM_MIN_AMP] | Summary row label | `Min Amplitude` |
| [AMP_SUM_MAX_AMP] | Summary row label | `Max Amplitude` |
| [AMP_SUM_MEAN_BR] | Summary row label | `Mean Breathing Rate` |

### Event History Section

| Key | Element | Current Text |
|-----|---------|--------------|
| [AMP_HISTORY_TITLE] | Section title | `Recent Amplitude Events` |

### Button

| Key | Element | Current Text |
|-----|---------|--------------|
| [AMP_BTN_END] | Primary button — while recording | `End Session` |
| [AMP_BTN_START] | Primary button — when idle | `Start Session` |

### Alert Dialog (BLE disconnect)

| Key | Element | Current Text |
|-----|---------|--------------|
| [AMP_ALERT_DISC_TITLE] | Alert title | `Device disconnected` |
| [AMP_ALERT_DISC_MSG] | Alert message body | `Connection lost. Returning to the main screen. This session was not saved.` |
| [AMP_ALERT_DISC_BTN] | Alert button | `OK` |

---

## Instructions Screen

File: `src/screens/InstructionsScreen.tsx`

| Key | Element | Current Text |
|-----|---------|--------------|
| [INS_TITLE] | Screen header title | `Instructions` |
| [INS_SEC1_TITLE] | Section 1 card title | `RMSSD` |
| [INS_SEC2_TITLE] | Section 2 card title | `RSA Amplitude` |

**[INS_SEC1_P1]** — RMSSD section, paragraph 1:
```
RMSSD is a metric associated with vagus nerve activity. Increased RMSSD indicates increased parasympathetic nervous system activation or calm.
```

**[INS_SEC1_P2]** — RMSSD section, paragraph 2:
```
RMSSD will be measured every 10 seconds. Red coloured feedback means the RMSSD is significantly less than the previous measurement, yellow means only slightly less than the previous and green means higher. Aim to increase your RMSSD throughout your session.
```

**[INS_SEC1_P3]** — RMSSD section, paragraph 3:
```
Conduct slow comfortable breathing with exhales longer than inhales. Try to breathe into your abdomen, a few inches below your navel. This will help you breathe in a more relaxed way. Aim to receive green feedback. This feature can be used for other calming exercises as well that would benefit from feedback.
```

**[INS_SEC2_P1]** — RSA Amplitude section, paragraph 1:
```
During inhalation, heart rate increases and during exhalation, heart rate decreases. This phenomenon is known as Respiratory Sinus Arrhythmia (RSA).
```

**[INS_SEC2_P2]** — RSA Amplitude section, paragraph 2:
```
During paced breathing, the heart rate graph resembles a wave and the amplitude of this wave is the RSA amplitude. Maximizing the RSA amplitude increases vagus nerve activity and promotes calm.
```

**[INS_SEC2_P3]** — RSA Amplitude section, paragraph 3:
```
In this feature, a heart rate graph is displayed, updating every second with an aim to increase the RSA amplitude. Attempt to synchronise your breathing to the heart rate graph, by inhaling when the heart rate increases and exhaling when the heart rate decreases. Alternatively, you may also conduct paced breathing without actively attempting to synchronise with the heart rate graph. Feedback on the RSA amplitude is provided. Green indicates the amplitude is larger or equal to the previous measured amplitude, yellow indicates the amplitude is only slightly smaller, and any smaller is indicated by red. Sound feedback is provided through a pleasant tone for green, a neutral tone for yellow and no sound for red.
```

**[INS_SEC2_P4]** — RSA Amplitude section, paragraph 4:
```
Conduct slow comfortable breathing and try to breathe into your abdomen, a few inches below your navel. This will help you breathe in a more relaxed way.
```

**[INS_SEC2_P5]** — RSA Amplitude section, paragraph 5:
```
With practice, you may notice a breathing rate that consistently maximizes your RSA amplitude. This is your resonant frequency, and knowing it allows you to simply breathe at this frequency to maximize calm without the need for feedback.
```

---

## Session History Screen

File: `src/screens/SessionHistoryScreen.tsx`

| Key | Element | Current Text |
|-----|---------|--------------|
| [SH_TITLE] | Screen header title | `Session History` |
| [SH_WEEKLY_CARD] | Tappable card link to Weekly Insights | `This Week's Feedback` |
| [SH_TRACKING_TITLE] | Long-term tracking section title | `LONG TERM TRACKING` |
| [SH_TRACKING_SUBTITLE] | Tracking section sub-label | `Week-over-week averages` |
| [SH_CHART1_LABEL] | Sparkline chart label | `Session Improvement (%)` |
| [SH_CHART2_LABEL] | Sparkline chart label | `Baseline RMSSD (ms)` |
| [SH_CHART3_LABEL] | Sparkline chart label | `Mean RSA Amplitude (bpm)` |
| [SH_CHART_EMPTY] | Sparkline empty-state — not enough data | `Need 2+ weeks of data` |
| [SH_WEEK_EMPTY_LABEL] | Week navigator label when no sessions exist | `No Sessions` |
| [SH_WEEK_EMPTY_TITLE] | Empty-state text in week table | `No sessions this week` |
| [SH_WEEK_EMPTY_SUB] | Empty-state sub-text in week table | `Complete a recording to see it here` |
| [SH_DELETE_ALERT_TITLE] | Delete confirmation alert title | `Delete session?` |
| [SH_DELETE_ALERT_MSG] | Delete confirmation alert message | `This session will be permanently removed from history.` |
| [SH_DELETE_ALERT_CANCEL] | Delete alert cancel button | `Cancel` |
| [SH_DELETE_ALERT_CONFIRM] | Delete alert destructive confirm button | `Delete` |

---

## Weekly Feedback Screen

File: `src/screens/WeeklyInsightsScreen.tsx`

### Header & Empty States

| Key | Element | Current Text |
|-----|---------|--------------|
| [WI_TITLE] | Screen header title | `Weekly Feedback` |
| [WI_DEMO_BANNER] | Banner shown in demo mode | `DEMO MODE` |
| [WI_EMPTY_TITLE] | Empty-state primary text | `No sessions yet` |
| [WI_EMPTY_SUB] | Empty-state secondary text | `Complete an HRV recording to see your feedback` |

### Summary Chips

| Key | Element | Current Text |
|-----|---------|--------------|
| [WI_CHIP_SESSIONS] | Summary chip label | `Sessions` |
| [WI_CHIP_TIME] | Summary chip label | `Total Time` |

### Main Cards

| Key | Element | Current Text |
|-----|---------|--------------|
| [WI_IMPROVE_LABEL] | Card label | `SESSION IMPROVEMENT` |
| [WI_IMPROVE_DESC] | Card descriptive sub-text | `Avg change from start to end of each HRV session` |
| [WI_BASELINE_LABEL] | Metric card label | `BASELINE RMSSD` |
| [WI_BASELINE_DESC] | Metric card sub-text | `Average RMSSD at the start of sessions this week` |
| [WI_RSA_LABEL] | Metric card label | `RSA AMPLITUDE` |
| [WI_RSA_DESC] | Metric card sub-text | `Average peak-to-trough heart rate swing during breathing` |

### Week-over-Week Section

| Key | Element | Current Text |
|-----|---------|--------------|
| [WI_WOW_TITLE] | Section title | `COMPARED TO LAST WEEK` |
| [WI_WOW_BASELINE_ROW] | Row label | `Baseline RMSSD` |
| [WI_WOW_IMPROVE_ROW] | Row label | `Session Improvement` |
| [WI_WOW_RSA_ROW] | Row label | `RSA Amplitude` |

### Dynamic Notes (auto-generated, edit template text only)

| Key | Element | Current Text |
|-----|---------|--------------|
| [WI_NOTE_NO_DATA] | Improvement note — no data this week | `No improvement data yet this week` |
| [WI_NOTE_STRONG] | Improvement note — ≥10% gain | `Strong improvement this week` |
| [WI_NOTE_STEADY] | Improvement note — 0–9% gain | `HRV held steady or improved during sessions` |
| [WI_NOTE_SLIGHT_DROP] | Improvement note — negative | `Slight decrease this week — normal variation` |
| [WI_WOW_NOTE_NO_PREV] | WoW note — no prior week data | `Need another week to show a comparison` |
| [WI_WOW_NOTE_SAME] | WoW note — negligible change | `About the same as last week` |

### Encouragement Card

| Key | Element | Current Text |
|-----|---------|--------------|
| [WI_ENCOURAGE_HIGH] | Encouragement text — 5+ sessions | `Great consistency this week.` |
| [WI_ENCOURAGE_MID] | Encouragement text — 3–4 sessions | `Good effort — aim for 5+ sessions next week.` |
| [WI_ENCOURAGE_LOW] | Encouragement text — < 3 sessions | `Every session builds the picture.` |
