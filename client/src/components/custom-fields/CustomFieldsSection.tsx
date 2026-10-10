import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { FieldDefinition } from '../../types/index.js';
import { api } from '../../api/client.js';

interface CustomFieldsSectionProps {
  entity: 'lead' | 'contact' | 'account' | 'deal';
  values: Record<string, any>;
  onChange?: (values: Record<string, any>) => void;
  readOnly?: boolean;
}

export const CustomFieldsSection: React.FC<CustomFieldsSectionProps> = ({
  entity,
  values = {},
  onChange,
  readOnly = false,
}) => {
  const { data: fields = [], isLoading } = useQuery<FieldDefinition[]>({
    queryKey: ['custom-fields', entity],
    queryFn: async () => {
      const res = await api.get(`/custom-fields?entity=${entity}&activeOnly=true`);
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2 py-1">
        <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
        <div className="h-8 w-full bg-zinc-100 dark:bg-zinc-800/60 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (fields.length === 0) {
    return null;
  }

  const handleFieldChange = (key: string, val: any) => {
    if (!onChange) return;
    onChange({
      ...values,
      [key]: val,
    });
  };

  if (readOnly) {
    return (
      <div className="space-y-3 pt-3 border-t border-border">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
          Custom Fields
        </h4>
        <div className="space-y-2.5">
          {fields.map((field) => {
            const val = values?.[field.key];
            const hasVal = val !== undefined && val !== null && val !== '';
            return (
              <div key={field._id} className="text-xs">
                <span className="text-muted block text-[11px] mb-0.5">{field.label}</span>
                {hasVal ? (
                  field.type === 'checkbox' ? (
                    <span className="font-medium text-foreground">{val ? 'Yes' : 'No'}</span>
                  ) : field.type === 'url' ? (
                    <a
                      href={String(val).startsWith('http') ? String(val) : `https://${val}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand hover:underline font-medium break-all"
                    >
                      {String(val)}
                    </a>
                  ) : (
                    <span className="font-medium text-foreground">{String(val)}</span>
                  )
                ) : (
                  <span className="text-muted/60 italic">—</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-3 border-t border-border">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
        Custom Fields
      </h4>
      <div className="space-y-3">
        {fields.map((field) => {
          const val = values?.[field.key] ?? '';

          switch (field.type) {
            case 'number':
              return (
                <div key={field._id}>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    {field.label} {field.required && '*'}
                  </label>
                  <input
                    type="number"
                    required={field.required}
                    value={val}
                    onChange={(e) =>
                      handleFieldChange(
                        field.key,
                        e.target.value === '' ? '' : Number(e.target.value)
                      )
                    }
                    className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                  />
                </div>
              );

            case 'date':
              return (
                <div key={field._id}>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    {field.label} {field.required && '*'}
                  </label>
                  <input
                    type="date"
                    required={field.required}
                    value={val ? String(val).slice(0, 10) : ''}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                  />
                </div>
              );

            case 'select':
              return (
                <div key={field._id}>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    {field.label} {field.required && '*'}
                  </label>
                  <select
                    required={field.required}
                    value={val}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                  >
                    <option value="">Select {field.label}...</option>
                    {(field.options || []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              );

            case 'checkbox':
              return (
                <div key={field._id} className="flex items-center gap-2.5 pt-1">
                  <input
                    type="checkbox"
                    id={`cf-${field.key}`}
                    checked={Boolean(val)}
                    onChange={(e) => handleFieldChange(field.key, e.target.checked)}
                    className="w-4 h-4 rounded border-border text-black dark:text-white focus:ring-black"
                  />
                  <label
                    htmlFor={`cf-${field.key}`}
                    className="text-xs font-medium text-foreground cursor-pointer"
                  >
                    {field.label} {field.required && '*'}
                  </label>
                </div>
              );

            case 'url':
              return (
                <div key={field._id}>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    {field.label} {field.required && '*'}
                  </label>
                  <input
                    type="url"
                    placeholder="https://"
                    required={field.required}
                    value={val}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                  />
                </div>
              );

            case 'text':
            default:
              return (
                <div key={field._id}>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    {field.label} {field.required && '*'}
                  </label>
                  <input
                    type="text"
                    required={field.required}
                    value={val}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-card border border-border rounded-xl text-foreground focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                  />
                </div>
              );
          }
        })}
      </div>
    </div>
  );
};
