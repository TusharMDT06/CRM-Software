import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle2, ShieldCheck, AlertCircle, Send } from 'lucide-react';

interface FormField {
  field: string;
  label: string;
  required: boolean;
}

interface FormSchemaResponse {
  formId: string;
  name: string;
  fields: FormField[];
  consentCheckboxText: string;
  successMessage: string;
  redirectUrl?: string;
  turnstileEnabled?: boolean;
}

export const PublicFormPage: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const [searchParams] = useSearchParams();

  const [formSchema, setFormSchema] = useState<FormSchemaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form values state
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [consentGiven, setConsentGiven] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Anti-spam honeypot trap
  const [hpTrap, setHpTrap] = useState('');

  useEffect(() => {
    if (!formId) return;
    setLoading(true);
    axios
      .get(`/api/f/${formId}`)
      .then((res) => {
        setFormSchema(res.data);
      })
      .catch((err) => {
        setErrorMsg(err.response?.data?.message || 'Form not found or unavailable');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [formId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formId || !formSchema || submitting) return;

    setSubmitting(true);
    setErrorMsg(null);

    // Extract UTM parameters and Click IDs from current window URL
    const utmSource = searchParams.get('utm_source');
    const utmMedium = searchParams.get('utm_medium');
    const utmCampaign = searchParams.get('utm_campaign');
    const utmTerm = searchParams.get('utm_term');
    const utmContent = searchParams.get('utm_content');
    const gclid = searchParams.get('gclid');
    const fbclid = searchParams.get('fbclid');

    const payload = {
      ...formData,
      _hp_trap: hpTrap, // Honeypot field (should be empty for legitimate users)
      consent: consentGiven,
      utm_source: utmSource || undefined,
      utm_medium: utmMedium || undefined,
      utm_campaign: utmCampaign || undefined,
      utm_term: utmTerm || undefined,
      utm_content: utmContent || undefined,
      gclid: gclid || undefined,
      fbclid: fbclid || undefined,
      referrer: document.referrer || window.location.href,
      landingPage: window.location.href,
    };

    try {
      const res = await axios.post(`/api/f/${formId}/submit`, payload);
      setSubmitted(true);

      if (res.data?.redirectUrl) {
        setTimeout(() => {
          window.location.href = res.data.redirectUrl;
        }, 1500);
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to submit form. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#121214] flex items-center justify-center p-4">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (errorMsg && !formSchema) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#121214] flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white dark:bg-[#1C1C20] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-8 text-center space-y-3 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
            Form Unavailable
          </h2>
          <p className="text-xs text-neutral-500">{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (submitted && formSchema) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#121214] flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white dark:bg-[#1C1C20] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-8 text-center space-y-4 shadow-sm animate-fade-in">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
            Submission Received
          </h2>
          <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
            {formSchema.successMessage}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#121214] flex items-center justify-center p-4 font-sans selection:bg-neutral-200 dark:selection:bg-neutral-800">
      <div className="max-w-lg w-full bg-white dark:bg-[#1C1C20] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            {formSchema?.name}
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Please fill in your details below and our team will get back to you.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Honeypot Trap - Invisible to humans, filled by bots */}
          <div style={{ display: 'none' }} aria-hidden="true">
            <label htmlFor="_hp_trap">Leave this field empty</label>
            <input
              id="_hp_trap"
              type="text"
              name="_hp_trap"
              tabIndex={-1}
              autoComplete="off"
              value={hpTrap}
              onChange={(e) => setHpTrap(e.target.value)}
            />
          </div>

          {/* Dynamic Form Fields */}
          {formSchema?.fields.map((field) => (
            <div key={field.field} className="space-y-1">
              <label className="font-semibold text-neutral-700 dark:text-neutral-300 block">
                {field.label} {field.required && <span className="text-rose-500">*</span>}
              </label>

              {field.field === 'notes' ? (
                <textarea
                  rows={3}
                  required={field.required}
                  value={formData[field.field] || ''}
                  onChange={(e) => setFormData({ ...formData, [field.field]: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition-shadow"
                />
              ) : (
                <input
                  type={field.field === 'email' ? 'email' : field.field === 'phone' ? 'tel' : 'text'}
                  required={field.required}
                  value={formData[field.field] || ''}
                  onChange={(e) => setFormData({ ...formData, [field.field]: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition-shadow"
                />
              )}
            </div>
          ))}

          {/* Consent Checkbox */}
          <div className="pt-2">
            <label className="flex items-start gap-2.5 cursor-pointer text-neutral-600 dark:text-neutral-400 text-[11px] leading-relaxed">
              <input
                type="checkbox"
                required
                checked={consentGiven}
                onChange={(e) => setConsentGiven(e.target.checked)}
                className="mt-0.5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 w-4 h-4 shrink-0"
              />
              <span>{formSchema?.consentCheckboxText}</span>
            </label>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-xl bg-black dark:bg-white text-white dark:text-black font-semibold text-xs hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Inquiry</span>
                </>
              )}
            </button>
          </div>

          <div className="text-center pt-2">
            <span className="text-[10px] text-neutral-400 flex items-center justify-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              <span>Secured by Flowdesk CRM</span>
            </span>
          </div>
        </form>
      </div>
    </div>
  );
};
