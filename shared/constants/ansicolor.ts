class AnsiColor {
  // Text colors
  public static readonly BLACK = '\x1b[30m';
  public static readonly RED = '\x1b[31m';
  public static readonly GREEN = '\x1b[32m';
  public static readonly YELLOW = '\x1b[33m';
  public static readonly BLUE = '\x1b[34m';
  public static readonly MAGENTA = '\x1b[35m';
  public static readonly CYAN = '\x1b[36m';
  public static readonly WHITE = '\x1b[37m';
  public static readonly RESET = '\x1b[0m';

  // Background colors
  public static readonly BG_BLACK = '\x1b[40m';
  public static readonly BG_RED = '\x1b[41m';
  public static readonly BG_GREEN = '\x1b[42m';
  public static readonly BG_YELLOW = '\x1b[43m';
  public static readonly BG_BLUE = '\x1b[44m';
  public static readonly BG_MAGENTA = '\x1b[45m';
  public static readonly BG_CYAN = '\x1b[46m';
  public static readonly BG_WHITE = '\x1b[47m';
}

export { AnsiColor };
