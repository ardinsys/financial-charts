export interface Formatter {
  formatYear(timestamp: number): string;
  formatMonth(timestamp: number): string;
  formatDay(timestamp: number): string;
  formatHour(timestamp: number): string;
  formatSecond?: (timestamp: number) => string;
  formatSubMinute?: (timestamp: number) => string;
  formatPrice(price: number): string;
  formatTooltipPrice(price: number, decimals: number): string;
  formatTooltipDate(timestamp: number): string;
  formatVolume(volume: number, price: number): string;
  setLocale(locale: string): void;
  getLocale(): string;
  setTimeZone?: (timeZone?: string) => void;
  getTimeZone?: () => string | undefined;
}

type DateFormatterName =
  | "year"
  | "month"
  | "day"
  | "hour"
  | "second"
  | "subMinute"
  | "tooltipDate";

type NumberFormatterName = "price" | "tooltipPrice" | "volume";

export interface DefaultFormatterOptions {
  locale?: string;
  timeZone?: string;
  dateTimeFormatOptions?: Partial<
    Record<DateFormatterName, Intl.DateTimeFormatOptions>
  >;
  numberFormatOptions?: Partial<
    Record<NumberFormatterName, Intl.NumberFormatOptions>
  >;
  volumeFormatOptions?: {
    compactThreshold?: number;
    minSignificantFraction?: number;
  };
}

const defaultDateTimeOptions: Record<
  DateFormatterName,
  Intl.DateTimeFormatOptions
> = {
  year: { year: "numeric" },
  month: { month: "short" },
  day: { day: "numeric" },
  hour: { hour: "numeric", minute: "2-digit" },
  second: { hour: "numeric", minute: "2-digit", second: "2-digit" },
  subMinute: {
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  },
  tooltipDate: {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  },
};

const defaultNumberOptions: Record<
  NumberFormatterName,
  Intl.NumberFormatOptions
> = {
  price: {},
  tooltipPrice: {},
  volume: {
    notation: "compact",
    compactDisplay: "short",
  },
};

const defaultVolumeOptions = {
  compactThreshold: 1_000,
  minSignificantFraction: 0.01,
};

type DateFormatters = Record<DateFormatterName, Intl.DateTimeFormat>;

export class DefaultFormatter implements Formatter {
  private locale: string;
  private timeZone?: string;
  private readonly dateTimeFormatOptions: Record<
    DateFormatterName,
    Intl.DateTimeFormatOptions
  >;
  private readonly numberFormatOptions: Record<
    NumberFormatterName,
    Intl.NumberFormatOptions
  >;
  private readonly volumeFormatOptions: typeof defaultVolumeOptions;

  private dateFormatters!: DateFormatters;
  private priceFormatter!: Intl.NumberFormat;
  private volumeFormatter!: Intl.NumberFormat;
  private tooltipPriceFormatters = new Map<number, Intl.NumberFormat>();

  constructor(options: DefaultFormatterOptions = {}) {
    this.locale = options.locale || DefaultFormatter.resolveDefaultLocale();
    this.timeZone = options.timeZone;
    this.dateTimeFormatOptions = {
      year: {
        ...defaultDateTimeOptions.year,
        ...options.dateTimeFormatOptions?.year,
      },
      month: {
        ...defaultDateTimeOptions.month,
        ...options.dateTimeFormatOptions?.month,
      },
      day: {
        ...defaultDateTimeOptions.day,
        ...options.dateTimeFormatOptions?.day,
      },
      hour: {
        ...defaultDateTimeOptions.hour,
        ...options.dateTimeFormatOptions?.hour,
      },
      second: {
        ...defaultDateTimeOptions.second,
        ...options.dateTimeFormatOptions?.second,
      },
      subMinute: {
        ...defaultDateTimeOptions.subMinute,
        ...options.dateTimeFormatOptions?.subMinute,
      },
      tooltipDate: {
        ...defaultDateTimeOptions.tooltipDate,
        ...options.dateTimeFormatOptions?.tooltipDate,
      },
    };
    this.numberFormatOptions = {
      price: {
        ...defaultNumberOptions.price,
        ...options.numberFormatOptions?.price,
      },
      tooltipPrice: {
        ...defaultNumberOptions.tooltipPrice,
        ...options.numberFormatOptions?.tooltipPrice,
      },
      volume: {
        ...defaultNumberOptions.volume,
        ...options.numberFormatOptions?.volume,
      },
    };
    this.volumeFormatOptions = {
      ...defaultVolumeOptions,
      ...options.volumeFormatOptions,
    };
    this.rebuildFormatters();
  }

  private static resolveDefaultLocale() {
    if (typeof navigator !== "undefined" && navigator.language) {
      return navigator.language;
    }
    return "en-US";
  }

  private withTimeZone(options: Intl.DateTimeFormatOptions) {
    if (!this.timeZone || options.timeZone) {
      return options;
    }
    return { ...options, timeZone: this.timeZone };
  }

  private rebuildFormatters() {
    this.dateFormatters = {
      year: new Intl.DateTimeFormat(
        this.locale,
        this.withTimeZone(this.dateTimeFormatOptions.year)
      ),
      month: new Intl.DateTimeFormat(
        this.locale,
        this.withTimeZone(this.dateTimeFormatOptions.month)
      ),
      day: new Intl.DateTimeFormat(
        this.locale,
        this.withTimeZone(this.dateTimeFormatOptions.day)
      ),
      hour: new Intl.DateTimeFormat(
        this.locale,
        this.withTimeZone(this.dateTimeFormatOptions.hour)
      ),
      second: new Intl.DateTimeFormat(
        this.locale,
        this.withTimeZone(this.dateTimeFormatOptions.second)
      ),
      subMinute: new Intl.DateTimeFormat(
        this.locale,
        this.withTimeZone(this.dateTimeFormatOptions.subMinute)
      ),
      tooltipDate: new Intl.DateTimeFormat(
        this.locale,
        this.withTimeZone(this.dateTimeFormatOptions.tooltipDate)
      ),
    };
    this.priceFormatter = new Intl.NumberFormat(
      this.locale,
      this.numberFormatOptions.price
    );
    this.volumeFormatter = new Intl.NumberFormat(
      this.locale,
      this.numberFormatOptions.volume
    );
    this.tooltipPriceFormatters.clear();
  }

  private getTooltipPriceFormatter(decimals: number) {
    const cachedFormatter = this.tooltipPriceFormatters.get(decimals);
    if (cachedFormatter) return cachedFormatter;

    const formatter = new Intl.NumberFormat(this.locale, {
      ...this.numberFormatOptions.tooltipPrice,
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals,
    });
    this.tooltipPriceFormatters.set(decimals, formatter);
    return formatter;
  }

  formatYear(timestamp: number): string {
    return this.dateFormatters.year.format(timestamp);
  }

  formatMonth(timestamp: number): string {
    return this.dateFormatters.month.format(timestamp);
  }

  formatDay(timestamp: number): string {
    return this.dateFormatters.day.format(timestamp);
  }

  formatHour(timestamp: number): string {
    return this.dateFormatters.hour.format(timestamp);
  }

  formatSecond(timestamp: number): string {
    return this.dateFormatters.second.format(timestamp);
  }

  formatSubMinute(timestamp: number): string {
    return this.dateFormatters.subMinute.format(timestamp);
  }

  formatPrice(price: number): string {
    return this.priceFormatter.format(price);
  }

  formatTooltipPrice(price: number, decimals: number): string {
    return this.getTooltipPriceFormatter(decimals).format(price);
  }

  formatTooltipDate(timestamp: number): string {
    return this.dateFormatters.tooltipDate.format(timestamp);
  }

  formatVolume(volume: number, _price: number): string {
    const fraction = Math.abs(volume - Math.trunc(volume));
    if (fraction >= this.volumeFormatOptions.minSignificantFraction) {
      return this.priceFormatter.format(volume);
    }
    if (Math.abs(volume) < this.volumeFormatOptions.compactThreshold) {
      return this.priceFormatter.format(volume);
    }
    return this.volumeFormatter.format(volume);
  }

  setLocale(locale: string): void {
    if (this.locale === locale) return;
    this.locale = locale;
    this.rebuildFormatters();
  }

  getLocale() {
    return this.locale;
  }

  setTimeZone(timeZone?: string): void {
    if (this.timeZone === timeZone) return;
    this.timeZone = timeZone;
    this.rebuildFormatters();
  }

  getTimeZone() {
    return this.timeZone;
  }
}
