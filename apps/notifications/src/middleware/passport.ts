import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import jwt from 'jsonwebtoken';
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID! as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET! as string,
      callbackURL: '/api/v1/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if the user already exists
        let user = await User.query().findOne({ google_id: profile.id });

        if (!user) {
          // Create a new user if not found
          user = await User.query().insert({
            google_id: profile.id,
            email: profile.emails ? profile.emails[0].value : '',
            name: profile.displayName,
            photo: profile.photos ? profile.photos[0].value : '',
          });
        }

        // Generate a token for the user
        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
          expiresIn: process.env.JWT_EXPIRES_IN,
        });

        return done(null, { user, token });
      } catch (err) {
        return done(err, false);
      }
    },
  ),
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const user = await User.query().findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});
