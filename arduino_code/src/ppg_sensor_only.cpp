#include <Arduino.h>

// Pin Definitions
const int POLAR_PIN = 7;
const int PULSE_SENSOR_PIN = A0;  // Pulse Sensor PURPLE WIRE connected to ANALOG PIN A0
const int LED13 = LED_BUILTIN;    // On-board Arduino LED

// Polar Sensor Variables
byte polarOldSample, polarSample;
int polarBeatCount = 0;
unsigned long polarLastBeatTime = 0;
unsigned long polarCurrentBeatTime = 0;
unsigned long polarBeatInterval = 0;
int polarBPM = 0;
const int polarNumReadings = 5;
int polarBpmReadings[polarNumReadings];
int polarReadIndex = 0;
int polarBpmTotal = 0;
int polarBpmAverage = 0;

// PulseSensor Variables
int Signal;                     // holds the incoming raw data. Signal value can range from 0-4095 on ESP32
int Threshold = 700;            // Determine which Signal to "count as a beat", and which to ignore
int count = 0;

// Sampling buffer for timer -> loop handoff
const uint8_t SAMPLE_BUFFER_SIZE = 64;
volatile int sampleBuffer[SAMPLE_BUFFER_SIZE];
volatile uint8_t sampleHead = 0;
volatile uint8_t sampleTail = 0;

// Timer flag (set in ISR, handled in loop)
volatile bool sampleFlag = false;
portMUX_TYPE sampleMux = portMUX_INITIALIZER_UNLOCKED;
hw_timer_t *sampleTimer = nullptr;

// Function Prototypes
void setupPolarSensor();
void readPolarSensor();
void setupPulseSensor();
void readPulseSensor();
void setupTimer100Hz();

// Timer ISR: just set a flag (keep ISR short)
void IRAM_ATTR onSampleTimer() {
  portENTER_CRITICAL_ISR(&sampleMux);
  sampleFlag = true;
  portEXIT_CRITICAL_ISR(&sampleMux);
}

void setupTimer100Hz() {
  // 80 MHz / 80 = 1 MHz timer tick -> 1 tick = 1 us
  sampleTimer = timerBegin(0, 80, true);
  timerAttachInterrupt(sampleTimer, &onSampleTimer, true);
  // 100 Hz = 10,000 us
  timerAlarmWrite(sampleTimer, 10000, true);
  timerAlarmEnable(sampleTimer);
}

void setup() {
  Serial.begin(115200);
  //setupPolarSensor();
  setupPulseSensor();
  setupTimer100Hz();
}

void loop() {
  //readPolarSensor();
  readPulseSensor();
}

// ========== POLAR SENSOR FUNCTIONS ==========

void setupPolarSensor() {
  pinMode(POLAR_PIN, INPUT);
  Serial.println("Waiting for heart beat...");

  // Initialize BPM readings array
  for (int i = 0; i < polarNumReadings; i++) {
    polarBpmReadings[i] = 0;
  }

  // Wait until a heart beat is detected
  while (!digitalRead(POLAR_PIN)) {};
  Serial.println("Heart beat detected!");
  polarLastBeatTime = millis();
}

void readPolarSensor() {
  polarSample = digitalRead(POLAR_PIN);

  if (polarSample && (polarOldSample != polarSample)) {
    // Beat detected
    polarCurrentBeatTime = millis();
    polarBeatInterval = polarCurrentBeatTime - polarLastBeatTime;
    polarLastBeatTime = polarCurrentBeatTime;

    // Calculate BPM from interval (60000 ms = 1 minute)
    polarBPM = 60000 / polarBeatInterval;

    // Add to running average
    polarBpmTotal = polarBpmTotal - polarBpmReadings[polarReadIndex];
    polarBpmReadings[polarReadIndex] = polarBPM;
    polarBpmTotal = polarBpmTotal + polarBpmReadings[polarReadIndex];
    polarReadIndex = (polarReadIndex + 1) % polarNumReadings;
    polarBpmAverage = polarBpmTotal / polarNumReadings;

    // Output results - ONLY when beat is detected, ONLY after 5 beats
    if (polarBeatCount > 5) {
      Serial.print(">");
      Serial.print("PolarRealtimeBPM:");
      Serial.print(polarBPM);
      Serial.print(",PolarBPM:");
      Serial.print(polarBpmAverage);
      Serial.println();
    }
    polarBeatCount++; // iterate number of beats
  }

  polarOldSample = polarSample;
}

// ========== PULSESENSOR FUNCTIONS ==========

void setupPulseSensor() {
  pinMode(LED13, OUTPUT);  // pin that will blink to your heartbeat!
}

void readPulseSensor() {
  bool doSample = false;

  portENTER_CRITICAL(&sampleMux);
  if (sampleFlag) {
    sampleFlag = false;
    doSample = true;
  }
  portEXIT_CRITICAL(&sampleMux);

  if (doSample) {
    int s = analogRead(PULSE_SENSOR_PIN);
    uint8_t nextHead = (sampleHead + 1) % SAMPLE_BUFFER_SIZE;
    if (nextHead != sampleTail) {
      sampleBuffer[sampleHead] = s;
      sampleHead = nextHead;
    }
  }

  int s;
  bool hasSample = false;

  portENTER_CRITICAL(&sampleMux);
  if (sampleTail != sampleHead) {
    s = sampleBuffer[sampleTail];
    sampleTail = (sampleTail + 1) % SAMPLE_BUFFER_SIZE;
    hasSample = true;
  }
  portEXIT_CRITICAL(&sampleMux);

  if (hasSample) {
    Signal = s;
    Serial.println(Signal); // Output only the signal
  }
}