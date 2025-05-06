declare global {
  namespace NodeJS {
    interface ProcessEnv {
      [key: string]: SN | undefined;
      APP_ENV?: 'development' | 'production' | 'testing';
      APP_PORT?: number;
      GITHUB_AUTH_TOKEN: string;
      NODE_ENV: 'development' | 'production';
      PORT?: string;
      PWD: string;
      DB_USER: string;
      DB_PASSWORD: string;
      JWT_SECRET: string;
      JWT_COOKIE_EXPIRES_IN: number;
      EMAIL_HOST: string;
      EMAIL_USERNAME: string;
      EMAIL_PASSWORD: string;
      SENDGRID_USERNAME: string;
      SENDGRID_PASSWORD: string;
    }
  }
}

// If this file has no import/export statements (i.e. is a script)
// convert it into a module by adding an empty export statement.
export {};
