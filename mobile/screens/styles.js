import { StyleSheet, Platform, StatusBar } from 'react-native';
import { COLORS, SPACING, TYPO } from './variables';
import { RADIUS, ELEVATION } from './variables';

const ANDROID_STATUS_PADDING = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
const EXTRA_HEADER_OFFSET = 0;

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  appShell: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    padding: 0,
    paddingTop: 0,
    backgroundColor: COLORS.background
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 6,
    marginTop: SPACING.small,
    backgroundColor: 'transparent'
  },
  footerText: {
    color: COLORS.link,
    fontSize: 12
  },
  contentCard: {
    width: '100%',
    padding: 0,
    flex: 1,
    alignSelf: 'stretch',
    marginTop: 0,
    borderRadius: 0,
    backgroundColor: COLORS.background,
    overflow: 'hidden',
    elevation: 0
  },
  titleBar: {
    width: '100%',
    paddingVertical: SPACING.base,
    paddingHorizontal: SPACING.base,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background
  },
  headerTitleSmall: {
    fontSize: TYPO.titleSize + 10,
    fontWeight: '900',
    color: COLORS.primary,
    textAlign: 'center',
    alignSelf: 'center',
    textShadowColor: COLORS.primary,
    textShadowRadius: 10
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  // Neon glow card with animated effect
  card: {
    backgroundColor: COLORS.cardBg,
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: RADIUS.large,
    padding: SPACING.large,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.glowCyan,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
    overflow: 'hidden'
  },
  // Card with green glow accent
  cardLatest: {
    backgroundColor: COLORS.cardBg,
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: RADIUS.large,
    padding: SPACING.large + 6,
    marginVertical: 12,
    borderWidth: 2,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.glowGreen,
    borderColor: COLORS.glowGreen,
    shadowColor: COLORS.glowGreen,
    shadowOpacity: 0.4,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
    overflow: 'hidden'
  },
  cardSmall: {
    backgroundColor: COLORS.cardBg,
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.glowCyan,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden'
  },
  
  metricCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.base + 4,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.glowYellow,
    borderColor: COLORS.border,
    marginBottom: SPACING.base + 4,
    shadowColor: COLORS.glowYellow,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden'
  },
  
  statusBadge: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.glowGreen,
    backgroundColor: COLORS.cardBg,
    shadowColor: COLORS.glowGreen,
    shadowOpacity: 0.3,
    shadowRadius: 6
  },
  
  sectionHeader: {
    fontSize: TYPO.h4,
    fontWeight: '800',
    color: COLORS.primaryLight,
    marginBottom: SPACING.base,
    letterSpacing: 1,
    textTransform: 'uppercase'
  },
  title: {
    fontSize: TYPO.titleSize + 6,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 8,
    textAlign: 'center'
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  metricBox: {
    flex: 1,
    alignItems: 'flex-start'
  },
  
  subtitle: {
    fontSize: TYPO.subtitleSize + 2,
    color: COLORS.text
  },
  latestValue: {
    fontSize: TYPO.bodySize + 10,
    fontWeight: '900',
    color: COLORS.primary
  },
  smallText: {
    fontSize: TYPO.smallSize,
    color: COLORS.muted
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    borderRadius: RADIUS.base,
    width: '100%',
    marginBottom: 12,
    backgroundColor: COLORS.cardBg,
    color: COLORS.text,
    shadowColor: COLORS.glowCyan,
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  // Neon glow primary button with pulse effect
  primaryButton: {
    backgroundColor: COLORS.glowBlue,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    alignSelf: 'stretch',
    width: '100%',
    shadowColor: COLORS.glowBlue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 1,
    borderColor: COLORS.glowBlue,
    overflow: 'hidden'
  },
  primaryButtonText: {
    color: COLORS.onPrimary,
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 16
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderColor: COLORS.primary,
    borderWidth: 2,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    alignSelf: 'stretch',
    width: '100%',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 16
  },
  linkText: {
    color: COLORS.link,
    marginTop: 8,
    fontSize: 14
  }
});
