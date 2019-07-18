'use strict';

module.exports = function(app, options) {
  options = options || {};

  // Globals
  global.__basedir = __dirname;
  global.__version = require('./package.json').version;

  // Node modules
  const BodyParser = require('body-parser');
  const Chalk = require('chalk');
  const CookieParser = require('cookie-parser');
  const Compression = require('compression');
  const DustHelpers = require('dustjs-helpers');
  const Express = require('express');
  const Path = require('path');
  const Promise = require('bluebird');
  const Slashes = require('connect-slashes');

  // Local modules
  const DustEngine = require(Path.join(__basedir, 'source/modules/dust_engine.js'));
  const DynamicImages = require(Path.join(__basedir, 'source/modules/dynamic_images.js'));
  const HtmlHelpers = require(Path.join(__basedir, 'source/modules/helpers/html_helpers.js'));
  const I18n = require(Path.join(__basedir, 'source/modules/i18n.js'));
  const ThemeHelpers = require(Path.join(__basedir, 'source/modules/helpers/theme_helpers.js'));
  const UtilityHelpers = require(Path.join(__basedir, 'source/modules/helpers/utility_helpers.js'));

  // Express app
  const AdminRouter = require(Path.join(__basedir, 'source/routers/admin_router.js'));
  const ApiRouter = require(Path.join(__basedir, 'source/routers/api_router.js'));
  const ThemeRouter = require(Path.join(__basedir, 'source/routers/theme_router.js'));
  const AuthMiddleware = require(Path.join(__basedir, 'source/middleware/auth_middleware'));
  const ViewMiddleware = require(Path.join(__basedir, 'source/middleware/view_middleware.js'));
  const ErrorController = require(Path.join(__basedir, 'source/controllers/error_controller.js'));

  // Database
  const Database = require(Path.join(__basedir, 'source/modules/database.js'))(options);
  app.locals.Database = Database;
  
  // Themes stored on app.locals so we can access the configured directory
  const Themes = require(Path.join(__basedir, 'source/modules/themes.js'))(options);
  app.locals.Themes = Themes;
  
  // Stash upload path on app.locals so we can access the configured directory
  app.locals.uploadPath = options.uploadPath || Path.join(__basedir, 'uploads');
  

  return Promise.resolve()
    // Initialize the database
    .then(() => Database.init())
    .then(() => {
      let models = Database.sequelize.models;

      // Generate search indexes on startup
      return Promise.all([
        models.post.buildSearchIndex(),
        models.user.buildSearchIndex(),
        models.tag.buildSearchIndex()
      ]);
    })
    // Load settings into app.locals.Settings
    .then(() => Database.loadSettings())
    .then((settings) => app.locals.Settings = settings)
    // Load navigation into app.locals.Navigation
    .then(() => Database.sequelize.models.navigation.getArray())
    .then((navigation) => app.locals.Navigation = navigation)
    // Load i18n into app.locals.I18n
    .then(() => {
      app.locals.I18n = I18n;
      return app.locals.I18n.load(app.locals.Settings.language);
    })
    // Start the app
    .then(() => {
      // App config
      app.enable('strict routing');
      app.disable('x-powered-by');

      // App-level middleware
      app
        .use(Slashes(false))
        .use(CookieParser())
        .use(Compression())
        .use(DynamicImages.processImages)
        .use('/assets', Express.static(Path.join(__basedir, 'assets')))
        .use('/themes', Express.static(Themes.themePath))
        .use('/uploads', Express.static(app.locals.uploadPath))
        .use(BodyParser.urlencoded({ extended: true, limit: '10mb' }))
        .use(AuthMiddleware.attachUser)
        .use(ViewMiddleware.attachViewData);

      // View engine
      app.engine('dust', DustEngine.engine(app, {
        cache: process.env.NODE_ENV === 'production',
        helpers: [DustHelpers, HtmlHelpers, UtilityHelpers, ThemeHelpers]
      }));
      app.set('json spaces', process.env.NODE_ENV === 'production' ? undefined : 2);
      app.set('views', [
        Path.join(Themes.themePath, app.locals.Settings.theme, 'templates'),
        Path.join(__basedir, 'source/views')
      ]);
      app.set('view engine', 'dust');

      // App routers
      ApiRouter(app);
      AdminRouter(app);
      ThemeRouter(app);

      // Error pages
      app.use(ErrorController.notFound);
      app.use(ErrorController.applicationError);
    })
    .catch((err) => {
      console.error(
        Chalk.red('Error: ') + 'Postleaf failed to initialize! 🐛\n\n' +
        Chalk.red(err.stack)
      );
    });
};
