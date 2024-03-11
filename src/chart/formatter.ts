export interface Formatter {
  formatYear(timestamp: number): string;
  formatMonth(timestamp: number): string;
  formatDay(timestamp: number): string;
  formatHour(timestamp: number): string;
  formatPrice(price: number): string;
  formatTooltipPrice(price: number, decimals: number): string;
  formatTooltipDate(timestamp: number): string;
  formatVolume(volume: number, price: number): string;
  setLocale(locale: string): void;
  getLocale(): string;
}

export class DefaultFormatter implements Formatter {
  private locale: string = navigator.language || "en-US";
  private yearFormatter = new Intl.DateTimeFormat(
    navigator.language || "en-US",
    { year: "numeric" }
  );
  private monthFormatter = new Intl.DateTimeFormat(
    navigator.language || "en-US",
    { month: "short" }
  );
  private dayFormatter = new Intl.DateTimeFormat(
    navigator.language || "en-US",
    { day: "numeric" }
  );
  private hourFormatter = new Intl.DateTimeFormat(
    navigator.language || "en-US",
    { hour: "numeric", minute: "2-digit" }
  );

  private tooltipDateFormatter = new Intl.DateTimeFormat(
    navigator.language || "en-US",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  );

  private volumeFormatter = new Intl.NumberFormat(
    navigator.language || "en-US",
    {
      notation: "compact",
      compactDisplay: "short",
    }
  );

  private priceFormatter = new Intl.NumberFormat(navigator.language || "en-US");

  formatYear(timestamp: number): string {
    return this.yearFormatter.format(timestamp);
  }

  formatMonth(timestamp: number): string {
    return this.monthFormatter.format(timestamp);
  }

  formatDay(timestamp: number): string {
    return this.dayFormatter.format(timestamp);
  }

  formatHour(timestamp: number): string {
    return this.hourFormatter.format(timestamp);
  }

  formatPrice(price: number): string {
    return this.priceFormatter.format(price);
  }

  formatTooltipPrice(price: number, decimals: number): string {
    return new Intl.NumberFormat(this.locale, {
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals,
    }).format(price);
  }

  formatTooltipDate(timestamp: number): string {
    return this.tooltipDateFormatter.format(timestamp);
  }

  formatVolume(volume: number, price: number): string {
    // Calculate the total value of the transaction
    const totalValue = volume * price;
    // Calculate the value of the fractional part of the volume
    const fractionalPartValue = (volume - Math.floor(volume)) * price;
    // Define the threshold for significance (e.g., 0.01% of the total value)
    const threshold = totalValue * 0.01; // Adjust this percentage as needed

    // Check if the fractional part's value is below the threshold
    if (fractionalPartValue < threshold) {
      // If the fractional part is not significant, format as volume
      return this.volumeFormatter.format(volume);
    } else {
      // If the fractional part is significant, perhaps format based on its value
      return this.priceFormatter.format(volume);
    }
  }

  setLocale(locale: string): void {
    this.locale = locale;
    this.yearFormatter = new Intl.DateTimeFormat(locale, { year: "numeric" });
    this.monthFormatter = new Intl.DateTimeFormat(locale, { month: "short" });
    this.dayFormatter = new Intl.DateTimeFormat(locale, { day: "numeric" });
    this.hourFormatter = new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "2-digit",
    });
    this.tooltipDateFormatter = new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    this.priceFormatter = new Intl.NumberFormat(locale);
    this.volumeFormatter = new Intl.NumberFormat(locale, {
      notation: "compact",
      compactDisplay: "short",
    });
  }

  getLocale() {
    return this.locale;
  }
}
