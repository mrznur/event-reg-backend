import { registerDecorator } from 'class-validator';
import type { ValidationOptions } from 'class-validator';

export function isIanaTimeZone(value: unknown): boolean {
  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }

  try {
    new Intl.DateTimeFormat('en-US', {
      timeZone: value,
    });

    return true;
  } catch {
    return false;
  }
}

export function IsIanaTimeZone(options?: ValidationOptions) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isIanaTimeZone',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} must be an IANA time zone such as Asia/Dhaka`,
      },
      validator: {
        validate(value: unknown): boolean {
          return isIanaTimeZone(value);
        },
      },
    });
  };
}
