import { StyleSheet, Platform, StatusBar } from 'react-native';
import { COLORS, SPACING, TYPO } from './variables';
import { RADIUS, ELEVATION } from './variables';

const ANDROID_STATUS_PADDING = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
const EXTRA_HEADER_OFFSET = 0; // keep small extra offset; header will use safe padding instead

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background
  },
  appShell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    paddingTop: 0,
    backgroundColor: COLORS.background
  },
  // footer in normal flow so it doesn't overlay app content
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
    maxWidth: 880,
    padding: SPACING.large,
    flex: 1,
    alignSelf: 'center',
    marginTop: 0,
    borderRadius: 0,
    backgroundColor: COLORS.cardBg,
    overflow: 'hidden',
    elevation: 0
  },
  titleBar: {
    width: '100%',
    paddingVertical: SPACING.small,
    paddingHorizontal: SPACING.base,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent'
  },
  headerTitleSmall: {
    fontSize: TYPO.titleSize + 10,
    fontWeight: '900',
    color: COLORS.primary,
    textAlign: 'center',
    alignSelf: 'center'
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  card: {
    backgroundColor: COLORS.cardBg,
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: RADIUS.large,
    padding: SPACING.large,
    marginVertical: 8,
    shadowColor: COLORS.shadow,
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3
  },
  cardLatest: {
    backgroundColor: COLORS.cardBg,
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: RADIUS.large,
    padding: SPACING.large + 6,
    marginVertical: 10,
    borderLeftWidth: 6,
    borderLeftColor: COLORS.primary,
    shadowColor: COLORS.shadow,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6
  },
  cardSmall: {
    backgroundColor: COLORS.cardBg,
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: RADIUS.small,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginVertical: 8,
    shadowColor: COLORS.shadow,
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: ELEVATION.low,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
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
    padding: 10,
    borderRadius: 8,
    width: '100%',
    marginBottom: 12,
    backgroundColor: COLORS.cardBg
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    alignSelf: 'stretch',
    width: '100%'
  },
  primaryButtonText: {
    color: COLORS.onPrimary,
    fontWeight: '700',
    textAlign: 'center'
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderColor: COLORS.primary,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    alignSelf: 'stretch',
    width: '100%'
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontWeight: '700'
  },
  linkText: {
    color: COLORS.link,
    marginTop: 8
  }
});
