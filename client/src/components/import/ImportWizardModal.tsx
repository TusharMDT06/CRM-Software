import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import { useQuery } from '@tanstack/react-query';
import {
  UploadCloud,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Download,
  Check,
  RefreshCw,
} from 'lucide-react';
import { FieldDefinition, User } from '../../types/index.js';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { useToast } from '../../context/ToastContext.js';
import { Modal } from '../ui/Modal.js';
import { Button } from '../ui/Button.js';
import { motion } from 'motion/react';

interface ImportWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  entity: 'lead' | 'contact' | 'account';
  onSuccess: () => void;
}

interface ColumnTarget {
  key: string;
  label: string;
  required?: boolean;
}

export const ImportWizardModal: React.FC<ImportWizardModalProps> = ({
  isOpen,
  onClose,
  entity,
  onSuccess,
}) => {
  const { user, isAdmin, isManager } = useAuth();
  const { success, error } = useToast();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // File state
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, any>[]>([]);

  // Mapping state: csvHeader -> targetFieldKey
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  // Owner selection (admin/manager)
  const [assignedOwner, setAssignedOwner] = useState<string>('');

  // Validation dryRun results
  const [isValidating, setIsValidating] = useState(false);
  const [dryRunSummary, setDryRunSummary] = useState<{
    total: number;
    valid: number;
    duplicates: number;
    errors: number;
  } | null>(null);
  const [validationErrors, setValidationErrors] = useState<Array<{ row: number; data: any; error: string }>>([]);
  const [duplicateAction, setDuplicateAction] = useState<'skip' | 'update'>('skip');

  // Execution state
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{
    created: number;
    updated: number;
    skipped: number;
    failed: number;
    errors: Array<{ row: number; data: any; error: string }>;
  } | null>(null);

  // Fetch custom fields for this entity to include in mapping
  const { data: customFields = [] } = useQuery<FieldDefinition[]>({
    queryKey: ['custom-fields', entity],
    queryFn: async () => {
      const res = await api.get(`/custom-fields?entity=${entity}&activeOnly=true`);
      return res.data;
    },
    enabled: isOpen,
  });

  // Fetch users for assigned owner dropdown (admin/manager)
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users-list'],
    queryFn: async () => {
      const res = await api.get('/users');
      return res.data;
    },
    enabled: (isAdmin || isManager) && isOpen,
  });

  // Base schema targets
  const targetFields: ColumnTarget[] = useMemo(() => {
    let base: ColumnTarget[] = [];
    if (entity === 'lead') {
      base = [
        { key: 'name', label: 'Name', required: true },
        { key: 'email', label: 'Email', required: true },
        { key: 'phone', label: 'Phone', required: true },
        { key: 'company', label: 'Company', required: true },
        { key: 'source', label: 'Source' },
        { key: 'status', label: 'Status' },
        { key: 'value', label: 'Value (INR)' },
        { key: 'notes', label: 'Notes' },
      ];
    } else if (entity === 'contact') {
      base = [
        { key: 'firstName', label: 'First Name', required: true },
        { key: 'lastName', label: 'Last Name', required: true },
        { key: 'email', label: 'Email', required: true },
        { key: 'phone', label: 'Phone' },
        { key: 'jobTitle', label: 'Job Title' },
        { key: 'account', label: 'Account / Company Name', required: true },
      ];
    } else if (entity === 'account') {
      base = [
        { key: 'name', label: 'Company Name', required: true },
        { key: 'industry', label: 'Industry', required: true },
        { key: 'website', label: 'Website' },
        { key: 'phone', label: 'Phone' },
        { key: 'city', label: 'City' },
        { key: 'employees', label: 'Employees' },
      ];
    }

    const cfTargets: ColumnTarget[] = customFields.map((cf) => ({
      key: `custom.${cf.key}`,
      label: `Custom: ${cf.label}`,
      required: cf.required,
    }));

    return [...base, ...cfTargets];
  }, [entity, customFields]);

  // Step 1: Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.size > 5 * 1024 * 1024) {
      error('File size exceeds maximum 5 MB');
      return;
    }

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          error('No data found in uploaded CSV');
          return;
        }

        if (results.data.length > 5000) {
          error('Maximum 5000 rows allowed per import file');
          return;
        }

        const headers = results.meta.fields || [];
        setFile(selectedFile);
        setCsvHeaders(headers);
        setCsvRows(results.data as Record<string, any>[]);

        // Auto-map headers
        const autoMap: Record<string, string> = {};
        headers.forEach((hdr) => {
          const normHdr = hdr.toLowerCase().replace(/[\s_-]/g, '');
          const match = targetFields.find((tf) => {
            const normKey = tf.key.toLowerCase().replace(/custom\./, '').replace(/[\s_-]/g, '');
            const normLabel = tf.label.toLowerCase().replace(/[\s_-]/g, '');
            return normHdr === normKey || normHdr === normLabel;
          });
          if (match) {
            autoMap[hdr] = match.key;
          } else {
            autoMap[hdr] = '__ignore__';
          }
        });

        setColumnMapping(autoMap);
        setStep(2);
      },
      error: (err) => {
        error(`Failed to parse CSV: ${err.message}`);
      },
    });
  };

  // Download Sample CSV
  const handleDownloadSample = () => {
    let sampleContent = '';
    if (entity === 'lead') {
      sampleContent = `Name,Email,Phone,Company,Source,Status,Value,Notes\n"Aarav Sharma","aarav@swiggy.in","+91 98200 12345","Swiggy Technologies","website","new",500000,"High interest in enterprise tier"`;
    } else if (entity === 'contact') {
      sampleContent = `First Name,Last Name,Email,Phone,Job Title,Account\n"Aarav","Sharma","aarav@swiggy.in","+91 98200 12345","VP Technology","Swiggy Technologies"`;
    } else if (entity === 'account') {
      sampleContent = `Company Name,Industry,Website,Phone,City,Employees\n"Swiggy Technologies","Consumer Tech","https://swiggy.com","+91 80 4000 0000","Bengaluru",4500`;
    }

    const blob = new Blob(['\uFEFF' + sampleContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sample_${entity}s_import.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Map raw CSV rows to Target schema objects
  const transformRows = () => {
    return csvRows.map((rawRow) => {
      const transformed: Record<string, any> = {};
      Object.entries(columnMapping).forEach(([header, targetKey]) => {
        if (targetKey && targetKey !== '__ignore__') {
          transformed[targetKey] = rawRow[header];
        }
      });
      return transformed;
    });
  };

  // Step 2 -> Step 3: Run Validation dryRun
  const handleValidateDryRun = async () => {
    try {
      setIsValidating(true);
      const rows = transformRows();
      const endpoint = entity === 'lead' ? '/leads/import' : entity === 'contact' ? '/contacts/import' : '/accounts/import';

      const res = await api.post(`${endpoint}?dryRun=true`, {
        rows,
        duplicateAction,
        assignedOwner: assignedOwner || undefined,
      });

      setDryRunSummary(res.data.summary);
      setValidationErrors(res.data.errors || []);
      setStep(3);
    } catch (err: any) {
      error(err.message || 'Validation failed');
    } finally {
      setIsValidating(false);
    }
  };

  // Step 3 -> Step 4: Execute Batched Import
  const handleExecuteImport = async () => {
    try {
      setIsImporting(true);
      setStep(4);
      const rows = transformRows();
      const endpoint = entity === 'lead' ? '/leads/import' : entity === 'contact' ? '/contacts/import' : '/accounts/import';

      const batchSize = 500;
      let createdTotal = 0;
      let updatedTotal = 0;
      let skippedTotal = 0;
      let failedTotal = 0;
      const allErrors: Array<{ row: number; data: any; error: string }> = [];

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const res = await api.post(endpoint, {
          rows: batch,
          duplicateAction,
          assignedOwner: assignedOwner || undefined,
        });

        const s = res.data.summary;
        createdTotal += s.created || 0;
        updatedTotal += s.updated || 0;
        skippedTotal += s.skipped || 0;
        failedTotal += s.failed || 0;
        if (res.data.errors) {
          allErrors.push(...res.data.errors);
        }

        const pct = Math.min(100, Math.round(((i + batch.length) / rows.length) * 100));
        setImportProgress(pct);
      }

      setImportResult({
        created: createdTotal,
        updated: updatedTotal,
        skipped: skippedTotal,
        failed: failedTotal,
        errors: allErrors,
      });

      success(`Import completed: ${createdTotal} created, ${updatedTotal} updated`);
      onSuccess();
    } catch (err: any) {
      error(err.message || 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  // Download Error Rows
  const handleDownloadErrorRows = () => {
    if (!importResult || importResult.errors.length === 0) return;
    const errorCsv = Papa.unparse(
      importResult.errors.map((e) => ({
        'Row Number': e.row,
        'Error Reason': e.error,
        ...e.data,
      }))
    );
    const blob = new Blob(['\uFEFF' + errorCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entity}_import_errors.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setStep(1);
    setFile(null);
    setCsvHeaders([]);
    setCsvRows([]);
    setColumnMapping({});
    setDryRunSummary(null);
    setValidationErrors([]);
    setImportResult(null);
    setImportProgress(0);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleReset}
      title={`Import ${entity.charAt(0).toUpperCase() + entity.slice(1)}s (CSV)`}
      size="lg"
    >
      <div className="space-y-6">
        {/* Step Indicator */}
        <div className="flex items-center justify-between border-b border-border pb-3 text-xs">
          {[
            { num: 1, label: 'Upload' },
            { num: 2, label: 'Map Columns' },
            { num: 3, label: 'Validate' },
            { num: 4, label: 'Import' },
          ].map((s) => (
            <div key={s.num} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center font-semibold text-xs ${
                  step === s.num
                    ? 'bg-black text-white dark:bg-white dark:text-black shadow-xs'
                    : step > s.num
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                    : 'bg-zinc-100 text-muted dark:bg-zinc-800'
                }`}
              >
                {step > s.num ? <Check className="w-3.5 h-3.5" /> : s.num}
              </div>
              <span
                className={`font-medium ${
                  step === s.num ? 'text-foreground font-semibold' : 'text-muted'
                }`}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* STEP 1: UPLOAD */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-2xl p-8 text-center bg-[#FAFAFA] dark:bg-[#1E1E24]/40 hover:border-neutral-400 transition-colors">
              <UploadCloud className="w-10 h-10 text-muted mx-auto mb-2" />
              <h4 className="text-sm font-semibold text-foreground">Select a .csv file to import</h4>
              <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
                File must be in CSV format, up to 5 MB (max 5,000 rows).
              </p>

              <label className="inline-flex mt-4 cursor-pointer">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <span className="px-4 py-2 bg-black text-white dark:bg-white dark:text-black font-semibold text-xs rounded-xl shadow-xs hover:opacity-90 transition-opacity">
                  Choose CSV File
                </span>
              </label>
            </div>

            <div className="flex items-center justify-between text-xs pt-2">
              <button
                type="button"
                onClick={handleDownloadSample}
                className="text-brand hover:underline font-medium flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download sample CSV template</span>
              </button>

              <span className="text-muted text-[11px]">UTF-8 encoded</span>
            </div>
          </div>
        )}

        {/* STEP 2: MAP COLUMNS */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p className="text-xs text-muted">
                Match each column header from <span className="font-semibold text-foreground">{file?.name}</span> ({csvRows.length} rows) to Flowdesk fields.
              </p>

              {(isAdmin || isManager) && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted">Assign Owner:</span>
                  <select
                    value={assignedOwner}
                    onChange={(e) => setAssignedOwner(e.target.value)}
                    className="px-2 py-1 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none"
                  >
                    <option value="">Myself ({user?.name})</option>
                    {users.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Column Mapping Table */}
            <div className="max-h-60 overflow-y-auto border border-border rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F8FA] dark:bg-[#202025] text-muted border-b border-border sticky top-0">
                  <tr>
                    <th className="py-2.5 px-4 font-medium">CSV Header</th>
                    <th className="py-2.5 px-4 font-medium">Sample Value (Row 1)</th>
                    <th className="py-2.5 px-4 font-medium">Map to CRM Field</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {csvHeaders.map((header) => {
                    const sampleVal = csvRows[0]?.[header] ?? '';
                    const mappedKey = columnMapping[header] || '__ignore__';

                    return (
                      <tr key={header} className="hover:bg-[#F8F8FA] dark:hover:bg-[#202025]/40">
                        <td className="py-2.5 px-4 font-medium text-foreground">{header}</td>
                        <td className="py-2.5 px-4 text-muted truncate max-w-[150px]">
                          {String(sampleVal)}
                        </td>
                        <td className="py-2.5 px-4">
                          <select
                            value={mappedKey}
                            onChange={(e) =>
                              setColumnMapping({ ...columnMapping, [header]: e.target.value })
                            }
                            className="w-full px-2 py-1.5 bg-card border border-border rounded-lg text-xs text-foreground focus:outline-none"
                          >
                            <option value="__ignore__">Ignore this column</option>
                            {targetFields.map((tf) => (
                              <option key={tf.key} value={tf.key}>
                                {tf.label} {tf.required ? '*' : ''}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Preview of first 5 mapped rows */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                First 5 Rows Preview
              </span>
              <div className="overflow-x-auto border border-border rounded-xl max-h-36">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-[#F8F8FA] dark:bg-[#202025] text-muted border-b border-border">
                    <tr>
                      {Object.entries(columnMapping)
                        .filter(([_, targetKey]) => targetKey !== '__ignore__')
                        .map(([_, targetKey]) => (
                          <th key={targetKey} className="py-2 px-3 font-medium whitespace-nowrap">
                            {targetFields.find((f) => f.key === targetKey)?.label || targetKey}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {csvRows.slice(0, 5).map((row, i) => (
                      <tr key={i}>
                        {Object.entries(columnMapping)
                          .filter(([_, targetKey]) => targetKey !== '__ignore__')
                          .map(([header, targetKey]) => (
                            <td key={targetKey} className="py-1.5 px-3 text-foreground whitespace-nowrap">
                              {String(row[header] ?? '-')}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-2">
              <Button variant="secondary" size="md" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleValidateDryRun}
                isLoading={isValidating}
              >
                <span>Validate Data</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: VALIDATION RESULTS */}
        {step === 3 && dryRunSummary && (
          <div className="space-y-4">
            {/* Summary KPI Badges */}
            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="p-3 rounded-xl bg-card border border-border">
                <span className="text-[10px] text-muted block uppercase">Total Rows</span>
                <span className="text-base font-bold text-foreground">{dryRunSummary.total}</span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
                <span className="text-[10px] block uppercase">Valid Rows</span>
                <span className="text-base font-bold">{dryRunSummary.valid}</span>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300">
                <span className="text-[10px] block uppercase">Duplicates</span>
                <span className="text-base font-bold">{dryRunSummary.duplicates}</span>
              </div>
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300">
                <span className="text-[10px] block uppercase">Errors</span>
                <span className="text-base font-bold">{dryRunSummary.errors}</span>
              </div>
            </div>

            {/* Duplicate Strategy Option */}
            <div className="p-3.5 bg-[#F8F8FA] dark:bg-[#1E1E24] rounded-xl border border-border space-y-2">
              <span className="text-xs font-semibold text-foreground">
                Duplicate Handling Strategy
              </span>
              <p className="text-[11px] text-muted">
                Duplicates are matched by email for Leads/Contacts, and company name for Accounts.
              </p>
              <div className="flex items-center gap-4 pt-1 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="dup-strategy"
                    checked={duplicateAction === 'skip'}
                    onChange={() => setDuplicateAction('skip')}
                    className="text-black"
                  />
                  <span>Skip duplicates (do not overwrite)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="dup-strategy"
                    checked={duplicateAction === 'update'}
                    onChange={() => setDuplicateAction('update')}
                    className="text-black"
                  />
                  <span>Update existing records</span>
                </label>
              </div>
            </div>

            {/* Error Rows Table */}
            {validationErrors.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                  Issues Found ({validationErrors.length} rows)
                </span>
                <div className="max-h-48 overflow-y-auto border border-red-200 dark:border-red-900 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-b border-red-200 dark:border-red-900">
                      <tr>
                        <th className="py-2 px-3 w-16">Row</th>
                        <th className="py-2 px-3">Validation Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-100 dark:divide-red-900/40">
                      {validationErrors.slice(0, 50).map((err, i) => (
                        <tr key={i}>
                          <td className="py-2 px-3 font-semibold text-muted">#{err.row}</td>
                          <td className="py-2 px-3 text-red-600 dark:text-red-400 font-mono text-[11px]">
                            {err.error}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex items-center justify-between pt-2">
              <Button variant="secondary" size="md" onClick={() => setStep(2)}>
                <ArrowLeft className="w-4 h-4" />
                <span>Adjust Mapping</span>
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleExecuteImport}
                disabled={dryRunSummary.valid === 0 && (dryRunSummary.duplicates === 0 || duplicateAction === 'skip')}
              >
                <span>Proceed to Import</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: IMPORT EXECUTION & SUMMARY */}
        {step === 4 && (
          <div className="space-y-5 text-center py-4">
            {isImporting ? (
              <div className="space-y-4 max-w-sm mx-auto">
                <RefreshCw className="w-8 h-8 text-brand animate-spin mx-auto" />
                <h4 className="text-sm font-semibold text-foreground">Importing records in batches...</h4>
                <div className="w-full bg-[#F4F4F5] dark:bg-[#202025] rounded-full h-2.5 overflow-hidden">
                  <motion.div
                    className="bg-brand h-2.5 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${importProgress}%` }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                  />
                </div>
                <span className="text-xs text-muted font-medium">{importProgress}% Completed</span>
              </div>
            ) : importResult ? (
              <div className="space-y-4 max-w-md mx-auto">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-foreground">Import Finished</h3>

                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2.5 bg-card border border-border rounded-xl">
                    <span className="text-muted block text-[10px]">Created</span>
                    <span className="font-bold text-emerald-600 text-sm">{importResult.created}</span>
                  </div>
                  <div className="p-2.5 bg-card border border-border rounded-xl">
                    <span className="text-muted block text-[10px]">Updated</span>
                    <span className="font-bold text-blue-600 text-sm">{importResult.updated}</span>
                  </div>
                  <div className="p-2.5 bg-card border border-border rounded-xl">
                    <span className="text-muted block text-[10px]">Skipped</span>
                    <span className="font-bold text-amber-600 text-sm">{importResult.skipped}</span>
                  </div>
                  <div className="p-2.5 bg-card border border-border rounded-xl">
                    <span className="text-muted block text-[10px]">Failed</span>
                    <span className="font-bold text-red-600 text-sm">{importResult.failed}</span>
                  </div>
                </div>

                {importResult.errors.length > 0 && (
                  <Button variant="secondary" size="sm" onClick={handleDownloadErrorRows}>
                    <Download className="w-3.5 h-3.5" />
                    <span>Download error rows as CSV</span>
                  </Button>
                )}

                <div className="pt-2">
                  <Button variant="primary" size="md" onClick={handleReset}>
                    Close
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </Modal>
  );
};
