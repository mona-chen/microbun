import jwt from 'jsonwebtoken';
import moment from 'moment'
export class Util {
  public static signToken = (id: number): string => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN!,
    });
  };

  public static formatDateTime(date: Date | string) {
    const parsedDate = new Date(date);

    if (isNaN(parsedDate.getTime())) {
      return 'Invalid Date';
    }

    const options: any = {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    };

    return new Intl.DateTimeFormat('en-US', options).format(parsedDate);
  }

  public static parseJSON(json: string) {
    // This function cannot be optimised, it's best to
    // keep it small!
    let parsed;

    try {
      parsed = JSON.parse(json);
    } catch (e) {
      // Oh well, but whatever...
      console.log(e);
    }

    return parsed; // Could be undefined!
  }

  /**
 * Converts any date format to "YYYY-MM-DD".
 * @param {Date} dateStr - The date string to convert.
 * @returns {string|null} - Returns the date in "YYYY-MM-DD" format, or null if invalid.
 */
public static convertToStandardDateFormat = (dateStr) => {
  let parsedDate = moment(dateStr, moment.ISO_8601, true);

  if (!parsedDate.isValid()) {
    // Try parsing with a more lenient approach
    parsedDate = moment(new Date(dateStr));
  }

  if (parsedDate.isValid()) {
    return parsedDate.format("YYYY-MM-DD HH:mm:ss");
  } else {
    console.warn(`Invalid date format: ${dateStr}`);
    return null;
  } 
};

  
}
