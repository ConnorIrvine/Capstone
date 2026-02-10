#include <Arduino.h>
#include <avr/interrupt.h>

// INDIVIDUALLY THIS CODE WORKS BUT COMBINED WE DO NOT READ THE DATA PROPERLY FOR THE POLAR SENSOR.
// WE CAN STILL MEASURE BOTH SIMULTANEOUSLY HOWEVER PRINTING PPG SENSOR MESSES WITH POLAR SENSOR DISPLAYING PROPERLY. WORK
// AROUND NEEDED

// Pin Definitions
const int POLAR_PIN = 7;
const int PULSE_SENSOR_PIN = 0;  // Pulse Sensor PURPLE WIRE connected to ANALOG PIN 0
const int LED13 = 13;            // On-board Arduino LED

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
int Signal;                      // holds the incoming raw data. Signal value can range from 0-1024
int Threshold = 700;            // Determine which Signal to "count as a beat", and which to ignore
int count = 0;

// Sampling buffer for ISR -> loop handoff
const uint8_t SAMPLE_BUFFER_SIZE = 64;
volatile int sampleBuffer[SAMPLE_BUFFER_SIZE];
volatile uint8_t sampleHead = 0;
volatile uint8_t sampleTail = 0;

// Function Prototypes
void setupPolarSensor();
void readPolarSensor();
void setupPulseSensor();
void readPulseSensor();

// Timer1 setup for 100 Hz (10 ms) interrupts on 16 MHz AVR
void setupTimer1_100Hz() {
  cli();
  TCCR1A = 0;
  TCCR1B = 0;
  TCNT1 = 0;
  // CTC mode
  TCCR1B |= (1 << WGM12);
  // Prescaler 64
  TCCR1B |= (1 << CS11) | (1 << CS10);
  // 16 MHz / 64 = 250 kHz; 100 Hz => 2500 counts; OCR1A = 2499
  OCR1A = 2499;
  // Enable compare match interrupt
  TIMSK1 |= (1 << OCIE1A);
  sei();
}

ISR(TIMER1_COMPA_vect) {
  int s = analogRead(PULSE_SENSOR_PIN);
  uint8_t nextHead = (sampleHead + 1) % SAMPLE_BUFFER_SIZE;
  if (nextHead != sampleTail) {
    sampleBuffer[sampleHead] = s;
    sampleHead = nextHead;
  }
  // If buffer is full, sample is dropped to keep ISR fast
}

void setup() { 
  Serial.begin(9600); 
  //setupPolarSensor();
  setupPulseSensor();
  setupTimer1_100Hz();
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
  int s;
  bool hasSample = false;

  noInterrupts();
  if (sampleTail != sampleHead) {
    s = sampleBuffer[sampleTail];
    sampleTail = (sampleTail + 1) % SAMPLE_BUFFER_SIZE;
    hasSample = true;
  }
  interrupts();

  if (hasSample) {
    Signal = s;
    Serial.println(Signal); // Output only the signal
  }
}