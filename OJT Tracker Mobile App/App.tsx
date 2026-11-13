import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  ActivityIndicator,
  AppState,
} from 'react-native';
import * as Updates from 'expo-updates';
import { OJTProvider, useOJT } from './src/context/OJTContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { LogsScreen } from './src/screens/LogsScreen';
import { AnalyticsScreen } from './src/screens/AnalyticsScreen';
import { ExportScreen } from './src/screens/ExportScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { FeedbackModal } from './src/components/FeedbackModal';
import { WhatsNewModal } from './src/components/WhatsNewModal';
import { CURRENT_RELEASE_VERSION, RELEASE_NOTES } from './src/data/whatsNew';
import { ojtStorage } from './src/storage/ojtStorage';
import { notificationService } from './src/services/notificationService';
import { ActiveTab } from './src/types/ojt';
import { telemetryService } from './src/services/telemetryService';

// Register global crash and fatal exception listener for Developer Monitoring Panel
if (typeof (global as any).ErrorUtils !== 'undefined') {
  const defaultErrorHandler = (global as any).ErrorUtils.getGlobalHandler();
  (global as any).ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
    telemetryService.reportCrash(error, !!isFatal, 'uncaught_exception').catch(() => {});
    if (defaultErrorHandler) {
      defaultErrorHandler(error, isFatal);
    }
  });
}

const AppContent: React.FC = () => {
  const { currentUser, sessionUser, profile, logout, authLoading, activeTab, setActiveTab, isDarkMode, toast, theme } = useOJT();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [showFeedbackModal, setShowFeedbackModal] = useState<boolean>(false);
  const [showWhatsNewModal, setShowWhatsNewModal] = useState<boolean>(false);

  // Check and apply OTA updates immediately when app opens in release/standalone mode
  useEffect(() => {
    const checkForOtaUpdates = async () => {
      try {
        if (!__DEV__) {
          const update = await Updates.checkForUpdateAsync();
          if (update.isAvailable) {
            await Updates.fetchUpdateAsync();
            await Updates.reloadAsync();
          }
        }
      } catch (e) {
        // Silently continue if offline
      }
    };
    checkForOtaUpdates();
  }, []);

  // Check if user has seen the current release notes for new builds or OTA updates
  useEffect(() => {
    const checkReleaseNotes = async () => {
      try {
        const lastSeen = await ojtStorage.getLastSeenRelease();
        if (lastSeen !== CURRENT_RELEASE_VERSION) {
          setShowWhatsNewModal(true);
          const release = RELEASE_NOTES[CURRENT_RELEASE_VERSION];
          if (release) {
            await notificationService.showWhatsNewNotification(
              CURRENT_RELEASE_VERSION,
              release.title,
              release.subtitle
            );
          }
        }
      } catch (e) {
        // Ignore
      }
    };
    checkReleaseNotes();
  }, []);

  // Instant Real-Time Presence Beacon on App Launch, Foreground, and Background Suspension
  useEffect(() => {
    const activeUid = currentUser?.uid || sessionUser?.uid;
    if (activeUid) {
      telemetryService.setOnlineStatus(activeUid, true);
    }

    const sub = AppState.addEventListener('change', (state) => {
      const uid = currentUser?.uid || sessionUser?.uid;
      if (!uid) return;

      if (state === 'active') {
        // App opened / brought to foreground -> instantly Active Now
        telemetryService.setOnlineStatus(uid, true);
      } else if (state === 'background' || state === 'inactive') {
        // App closed / minimized / sent to background -> instantly Inactive/Offline
        telemetryService.setOnlineStatus(uid, false);
      }
    });

    return () => sub.remove();
  }, [currentUser?.uid, sessionUser?.uid]);

  const bgApp = theme.bgScreen;
  const bgHeader = theme.bgHeader;
  const bgNav = theme.bgCard;
  const textPrimary = theme.textPrimary;
  const textSecondary = theme.textSecondary;
  const borderCol = theme.cardBorder;

  // 1. Loading Splash State
  if (authLoading) {
    return (
      <View style={[styles.centerLoading, { backgroundColor: bgApp }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: textSecondary }]}>
          Loading OJT Hours Tracker...
        </Text>
      </View>
    );
  }

  // 2. Unauthenticated State (Login / Register Flow) - Only if no active session
  if (!currentUser && !sessionUser) {
    return (
      <>
        {authMode === 'login' ? (
          <LoginScreen onNavigateToRegister={() => setAuthMode('register')} />
        ) : (
          <RegisterScreen onNavigateToLogin={() => setAuthMode('login')} />
        )}
        <WhatsNewModal
          visible={showWhatsNewModal}
          onClose={() => setShowWhatsNewModal(false)}
          isDarkMode={isDarkMode}
        />
      </>
    );
  }

  // 3. Authenticated State (Main 5-Tab App Shell)
  const renderScreen = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardScreen />;
      case 'logs':
        return <LogsScreen />;
      case 'analytics':
        return <AnalyticsScreen />;
      case 'export':
        return <ExportScreen />;
      case 'profile':
        return <ProfileScreen />;
      default:
        return <DashboardScreen />;
    }
  };

  const navItems: { tab: ActiveTab; label: string; icon: string }[] = [
    { tab: 'dashboard', label: 'Home', icon: '⚡' },
    { tab: 'logs', label: 'Journal', icon: '📋' },
    { tab: 'analytics', label: 'Analytics', icon: '📊' },
    { tab: 'export', label: 'DTR Export', icon: '🎓' },
    { tab: 'profile', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgApp }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Top Header Bar */}
      <View style={[styles.appHeader, { backgroundColor: bgHeader, borderBottomColor: borderCol }]}>
        <View style={styles.brandAndUser}>
          <View style={styles.brandRow}>
            <Text style={styles.brandLogoIcon}>⚡</Text>
            <Text style={[styles.brandTitle, { color: textPrimary }]}>
              Track<Text style={{ color: theme.primary }}>IT</Text>
            </Text>
          </View>
          <Text style={[styles.userSubName, { color: textSecondary }]} numberOfLines={1}>
            👤 {profile.internName || 'Intern'}
          </Text>
        </View>

        <View style={styles.headerActionsRow}>
          <TouchableOpacity
            style={styles.btnHeaderFeedback}
            onPress={() => setShowFeedbackModal(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.btnHeaderFeedbackIcon}>💬</Text>
            <Text style={styles.btnHeaderFeedbackText}>Feedback</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnHeaderLogout}
            onPress={logout}
            activeOpacity={0.7}
          >
            <Text style={styles.btnHeaderLogoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Floating Toast Notification Banner */}
      {toast && (
        <View
          style={[
            styles.toastBanner,
            toast.type === 'warning'
              ? styles.toastWarning
              : toast.type === 'info'
              ? styles.toastInfo
              : styles.toastSuccess,
          ]}
        >
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      )}

      {/* Main Screen Body */}
      <View style={styles.body}>{renderScreen()}</View>

      {/* Bottom Navigation Tab Bar */}
      <View style={[styles.navBar, { backgroundColor: bgNav, borderTopColor: borderCol }]}>
        {navItems.map((item) => {
          const isActive = activeTab === item.tab;
          return (
            <TouchableOpacity
              key={item.tab}
              style={styles.navTab}
              onPress={() => setActiveTab(item.tab)}
            >
              <Text style={[styles.navIcon, isActive && styles.navIconActive]}>
                {item.icon}
              </Text>
              <Text
                style={[
                  styles.navLabel,
                  { color: isActive ? theme.primary : textSecondary },
                  isActive && styles.navLabelActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Floating Feedback Modal */}
      <FeedbackModal
        visible={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
      />

      {/* Release Announcement / What's New Modal */}
      <WhatsNewModal
        visible={showWhatsNewModal}
        onClose={() => setShowWhatsNewModal(false)}
        isDarkMode={isDarkMode}
      />
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <OJTProvider>
      <AppContent />
    </OJTProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
  },
  appHeader: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  brandAndUser: {
    justifyContent: 'center',
    maxWidth: '48%',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  brandLogoIcon: {
    fontSize: 16,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  userSubName: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  btnHeaderFeedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#3b82f618',
    borderColor: '#3b82f633',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  btnHeaderFeedbackIcon: {
    fontSize: 12,
  },
  btnHeaderFeedbackText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '700',
  },
  btnHeaderLogout: {
    backgroundColor: '#ef444415',
    borderColor: '#ef444433',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  btnHeaderLogoutText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
  },
  toastBanner: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastSuccess: {
    backgroundColor: '#10b981',
  },
  toastInfo: {
    backgroundColor: '#3b82f6',
  },
  toastWarning: {
    backgroundColor: '#ef4444',
  },
  toastText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  body: {
    flex: 1,
  },
  navBar: {
    flexDirection: 'row',
    height: 60,
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 10 : 0,
  },
  navTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIcon: {
    fontSize: 18,
    opacity: 0.7,
  },
  navIconActive: {
    opacity: 1,
    transform: [{ scale: 1.15 }],
  },
  navLabel: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '500',
  },
  navLabelActive: {
    fontWeight: '800',
  },
});
