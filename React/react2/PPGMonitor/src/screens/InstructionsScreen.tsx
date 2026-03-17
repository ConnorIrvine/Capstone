import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ImageBackground,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface Props {
  onBack: () => void;
}

interface Section {
  title: string;
  icon: string;
  color: string;
  paragraphs: string[];
}

const SECTIONS: Section[] = [
  {
    title: 'RMSSD',
    icon: 'heart-pulse',
    color: '#00E676',
    paragraphs: [
      'RMSSD is a metric associated with vagus nerve activity. Increased RMSSD indicates increased parasympathetic nervous system activation or calm.',
      'RMSSD will be measured every 10 seconds. Red coloured feedback means the RMSSD is significantly less than the previous measurement, yellow means only slightly less than the previous and green means higher. Aim to increase your RMSSD throughout your session.',
      'Conduct slow comfortable breathing with exhales longer than inhales. Try to breathe into your abdomen, a few inches below your navel. This will help you breathe in a more relaxed way. Aim to receive green feedback. This feature can be used for other calming exercises as well that would benefit from feedback.',
    ],
  },
  {
    title: 'RSA Amplitude',
    icon: 'waveform',
    color: '#82b1ff',
    paragraphs: [
      'During inhalation, heart rate increases and during exhalation, heart rate decreases. This phenomenon is known as Respiratory Sinus Arrhythmia (RSA).',
      'During paced breathing, the heart rate graph resembles a wave and the amplitude of this wave is the RSA amplitude. Maximizing the RSA amplitude increases vagus nerve activity and promotes calm.',
      'In this feature, a heart rate graph is displayed, updating every second with an aim to increase the RSA amplitude. Attempt to synchronise your breathing to the heart rate graph, by inhaling when the heart rate increases and exhaling when the heart rate decreases. Alternatively, you may also conduct paced breathing without actively attempting to synchronise with the heart rate graph. Feedback on the RSA amplitude is provided. Green indicates the amplitude is larger or equal to the previous measured amplitude, yellow indicates the amplitude is only slightly smaller, and any smaller is indicated by red. Sound feedback is provided through a pleasant tone for green, a neutral tone for yellow and no sound for red.',
      'Conduct slow comfortable breathing and try to breathe into your abdomen, a few inches below your navel. This will help you breathe in a more relaxed way.',
      'With practice, you may notice a breathing rate that consistently maximizes your RSA amplitude. This is your resonant frequency, and knowing it allows you to simply breathe at this frequency to maximize calm without the need for feedback.',
    ],
  },
];

const InstructionsScreen: React.FC<Props> = ({onBack}) => {
  return (
    <ImageBackground
      source={require('../assets/images/background2.jpg')}
      style={styles.bg}
      resizeMode="cover">
      <View style={styles.overlay} />
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Icon name="arrow-left" size={28} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Instructions</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {SECTIONS.map(section => (
          <View key={section.title} style={styles.card}>
            {/* Section heading */}
            <View style={styles.cardHeader}>
              <View style={[styles.iconBadge, {backgroundColor: `${section.color}22`}]}>
                <Icon name={section.icon} size={22} color={section.color} />
              </View>
              <Text style={[styles.cardTitle, {color: section.color}]}>{section.title}</Text>
            </View>

            <View style={[styles.divider, {backgroundColor: `${section.color}33`}]} />

            {section.paragraphs.map((para, i) => (
              <Text key={i} style={styles.bodyText}>
                {para}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  bg: {flex: 1, width: '100%', height: '100%'},
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,5,30,0.55)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backBtn: {marginRight: 14, padding: 4},
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  scroll: {flex: 1},
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 48,
    gap: 16,
  },
  card: {
    backgroundColor: 'rgba(80, 55, 160, 0.55)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(180, 150, 255, 0.2)',
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  divider: {
    height: 1,
    borderRadius: 1,
    marginBottom: 4,
  },
  bodyText: {
    fontSize: 14,
    color: 'rgba(220, 205, 255, 0.88)',
    lineHeight: 22,
  },
});

export default InstructionsScreen;
