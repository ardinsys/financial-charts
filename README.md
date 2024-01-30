# Financial charts

**Still in BETA.**

Canvas based charting library for price charts with a dead simple API, which supports themes, custom locales or even a full custom formatter for dates and prices.

## Features

- more than fast enough
- small (9.4 kB gzipped) (no 3rd party dependencies)
- framework agnostic
- touch support
- zooming, panning
- your data will be automatically mapped to the give step size
- extendable with your own controllers (library is built to support financial charts, time based X axis with number based Y, keep this in mind while we are talking about extensibility)
- you can make custom themes, or use the default light/dark theme
- you can change the locale or you can even replace the whole formatter

## Planned features

- detailed documentation
- non interactive indicators (only API, UI needs to be made separately)
- interactive drawing (only API, UI needs to be made separately)
- support for use case when you do not want to display a fixed timerange, rather some infite time like trading view does. (will also support realtime moving when new data arrives)
- sync between multiple charts if applicable
