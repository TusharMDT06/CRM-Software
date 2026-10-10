import { FieldDefinition } from '../models/FieldDefinition.js';
import { EntityType } from '../models/Activity.js';

export async function validateCustomFields(
  entity: EntityType,
  customData: any,
  isNew: boolean
): Promise<{ valid: boolean; error?: string; cleanData?: Record<string, any> }> {
  if (customData === undefined || customData === null) {
    customData = {};
  }

  if (typeof customData !== 'object' || Array.isArray(customData)) {
    return { valid: false, error: 'Custom fields must be a key-value object' };
  }

  const definitions = await FieldDefinition.find({ entity, active: true });
  const defMap = new Map<string, (typeof definitions)[0]>();
  for (const def of definitions) {
    defMap.set(def.key, def);
  }

  // 1. Reject unknown keys
  for (const key of Object.keys(customData)) {
    if (!defMap.has(key)) {
      return { valid: false, error: `Unknown custom field "${key}" for ${entity}` };
    }
  }

  const cleanData: Record<string, any> = {};

  // 2. Enforce required (for new records) and validate types
  for (const def of definitions) {
    const val = customData[def.key];

    if (val === undefined || val === null || val === '') {
      if (isNew && def.required) {
        return { valid: false, error: `Custom field "${def.label}" is required` };
      }
      continue;
    }

    switch (def.type) {
      case 'text':
        cleanData[def.key] = String(val);
        break;

      case 'number': {
        const num = Number(val);
        if (isNaN(num)) {
          return { valid: false, error: `Custom field "${def.label}" must be a number` };
        }
        cleanData[def.key] = num;
        break;
      }

      case 'date': {
        const d = new Date(val);
        if (isNaN(d.getTime())) {
          return { valid: false, error: `Custom field "${def.label}" must be a valid date` };
        }
        cleanData[def.key] = d.toISOString();
        break;
      }

      case 'select': {
        const strVal = String(val);
        if (def.options.length > 0 && !def.options.includes(strVal)) {
          return {
            valid: false,
            error: `Value "${strVal}" is not valid for "${def.label}". Allowed: ${def.options.join(', ')}`,
          };
        }
        cleanData[def.key] = strVal;
        break;
      }

      case 'checkbox':
        cleanData[def.key] = Boolean(val);
        break;

      case 'url': {
        const urlStr = String(val);
        try {
          new URL(urlStr);
          cleanData[def.key] = urlStr;
        } catch {
          // Allow loose url e.g. "www.example.com" or "http/https"
          if (/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/.test(urlStr)) {
            cleanData[def.key] = urlStr;
          } else {
            return { valid: false, error: `Custom field "${def.label}" must be a valid URL` };
          }
        }
        break;
      }

      default:
        cleanData[def.key] = val;
    }
  }

  return { valid: true, cleanData };
}
