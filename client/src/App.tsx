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
import { AiSettingsPage } from './pages/AiSettingsPage.js';
import { QuotesListPage } from './pages/QuotesListPage.js';
import { QuoteBuilderPage } from './pages/QuoteBuilderPage.js';
import { PublicQuotePage } from './pages/PublicQuotePage.js';
import { InvoicesListPage } from './pages/InvoicesListPage.js';
import { InvoiceDetailPage } from './pages/InvoiceDetailPage.js';
import { AutomationsPage } from './pages/AutomationsPage.js';
import { NotificationsPage } from './pages/NotificationsPage.js';
import { NotificationSettingsPage } from './pages/NotificationSettingsPage.js';
import { AuditLogPage } from './pages/AuditLogPage.js';

// Phase 4 Stage 1 Pages
import { SignupPage } from './pages/SignupPage.js';
import { VerifyEmailPage } from './pages/VerifyEmailPage.js';
import { AcceptInvitePage } from './pages/AcceptInvitePage.js';
import { PlatformPage } from './pages/PlatformPage.js';

// Phase 4 Stage 2 Pages
import { TicketsListPage } from './pages/TicketsListPage.js';
import { TicketDetailPage } from './pages/TicketDetailPage.js';
import { PublicSupportPortalPage } from './pages/PublicSupportPortalPage.js';
import { PublicTicketStatusPage } from './pages/PublicTicketStatusPage.js';

// Phase 5 Marketing Pages
import { LeadSourcesPage } from './pages/marketing/LeadSourcesPage.js';
import { WebFormsPage } from './pages/marketing/WebFormsPage.js';
import { CampaignsPage } from './pages/marketing/CampaignsPage.js';
import { PublicFormPage } from './pages/public/PublicFormPage.js';

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
                  <Route path="/signup" element={<SignupPage />} />
                  <Route path="/verify-email" element={<VerifyEmailPage />} />
                  <Route path="/accept-invite" element={<AcceptInvitePage />} />
                  <Route path="/q/:publicToken" element={<PublicQuotePage />} />
                  <Route path="/support/:tenantSlug" element={<PublicSupportPortalPage />} />
                  <Route path="/support/status/:publicToken" element={<PublicTicketStatusPage />} />
                  <Route path="/f/:formId" element={<PublicFormPage />} />

                  {/* Platform Area (platform_admin only, standalone minimal shell) */}
                  <Route
                    path="/platform"
                    element={
                      <AuthGuard>
                        <PlatformPage />
                      </AuthGuard>
                    }
                  />

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

                    {/* Support Section */}
                    <Route path="tickets" element={<TicketsListPage />} />
                    <Route path="tickets/:id" element={<TicketDetailPage />} />

                    {/* Automation Section */}
                    <Route path="automations" element={<AutomationsPage />} />
                    <Route path="templates" element={<TemplatesPage />} />

                    {/* Notifications */}
                    <Route path="notifications" element={<NotificationsPage />} />
                    {/* Marketing Section */}
                    <Route
                      path="marketing/sources"
                      element={
                        <AuthGuard managerOnly>
                          <LeadSourcesPage />
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="marketing/forms"
                      element={
                        <AuthGuard managerOnly>
                          <WebFormsPage />
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="marketing/campaigns"
                      element={
                        <AuthGuard managerOnly>
                          <CampaignsPage />
                        </AuthGuard>
                      }
                    />

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
                      path="settings/ai"
                      element={
                        <AuthGuard adminOnly>
                          <AiSettingsPage />
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
