import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './context/ThemeContext.js';
import { ToastProvider } from './context/ToastContext.js';
import { AuthProvider } from './context/AuthContext.js';
import { AuthGuard } from './components/common/AuthGuard.js';
import { AppLayout } from './components/layout/AppLayout.js';

// Phase 1 Pages
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { LeadsPage } from './pages/LeadsPage.js';
import { ContactsPage } from './pages/ContactsPage.js';
import { AccountsPage } from './pages/AccountsPage.js';
import { DealsPage } from './pages/DealsPage.js';
import { TasksPage } from './pages/TasksPage.js';
import { TeamPage } from './pages/TeamPage.js';

// Phase 2 Pages
import { LeadDetailPage } from './pages/LeadDetailPage.js';
import { ContactDetailPage } from './pages/ContactDetailPage.js';
import { AccountDetailPage } from './pages/AccountDetailPage.js';
import { DealDetailPage } from './pages/DealDetailPage.js';
import { TemplatesPage } from './pages/TemplatesPage.js';
import { ReportsPage } from './pages/ReportsPage.js';
import { CustomFieldsSettingsPage } from './pages/CustomFieldsSettingsPage.js';

// Phase 3 Pages
import { ProductsPage } from './pages/ProductsPage.js';
import { CompanySettingsPage } from './pages/CompanySettingsPage.js';
import { QuotesListPage } from './pages/QuotesListPage.js';
import { QuoteBuilderPage } from './pages/QuoteBuilderPage.js';
import { PublicQuotePage } from './pages/PublicQuotePage.js';
import { InvoicesListPage } from './pages/InvoicesListPage.js';
import { InvoiceDetailPage } from './pages/InvoiceDetailPage.js';
import { AutomationsPage } from './pages/AutomationsPage.js';
import { NotificationsPage } from './pages/NotificationsPage.js';
import { NotificationSettingsPage } from './pages/NotificationSettingsPage.js';
import { AuditLogPage } from './pages/AuditLogPage.js';

import { MotionConfig } from 'motion/react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      retry: 1,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <MotionConfig reducedMotion="user">
              <BrowserRouter>
                <Routes>
                  {/* Public Routes outside App Shell */}
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/q/:publicToken" element={<PublicQuotePage />} />

                  {/* Protected Application Routes */}
                  <Route
                    path="/"
                    element={
                      <AuthGuard>
                        <AppLayout />
                      </AuthGuard>
                    }
                  >
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<DashboardPage />} />
                    
                    {/* Sales Section */}
                    <Route path="leads" element={<LeadsPage />} />
                    <Route path="leads/:id" element={<LeadDetailPage />} />
                    <Route path="contacts" element={<ContactsPage />} />
                    <Route path="contacts/:id" element={<ContactDetailPage />} />
                    <Route path="accounts" element={<AccountsPage />} />
                    <Route path="accounts/:id" element={<AccountDetailPage />} />
                    <Route path="deals" element={<DealsPage />} />
                    <Route path="deals/:id" element={<DealDetailPage />} />
                    <Route path="tasks" element={<TasksPage />} />
                    <Route path="products" element={<ProductsPage />} />

                    {/* Billing Section */}
                    <Route path="quotes" element={<QuotesListPage />} />
                    <Route path="quotes/new" element={<QuoteBuilderPage />} />
                    <Route path="quotes/:id" element={<QuoteBuilderPage />} />
                    <Route path="invoices" element={<InvoicesListPage />} />
                    <Route path="invoices/:id" element={<InvoiceDetailPage />} />

                    {/* Automation Section */}
                    <Route path="automations" element={<AutomationsPage />} />
                    <Route path="templates" element={<TemplatesPage />} />

                    {/* Notifications */}
                    <Route path="notifications" element={<NotificationsPage />} />
                    <Route path="settings/notifications" element={<NotificationSettingsPage />} />

                    {/* Admin Section */}
                    <Route path="reports" element={<ReportsPage />} />
                    <Route
                      path="audit-log"
                      element={
                        <AuthGuard adminOnly>
                          <AuditLogPage />
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="settings/company"
                      element={
                        <AuthGuard adminOnly>
                          <CompanySettingsPage />
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="settings/custom-fields"
                      element={
                        <AuthGuard adminOnly>
                          <CustomFieldsSettingsPage />
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="team"
                      element={
                        <AuthGuard adminOnly>
                          <TeamPage />
                        </AuthGuard>
                      }
                    />
                  </Route>

                  {/* Catch-all Fallback */}
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </BrowserRouter>
            </MotionConfig>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
