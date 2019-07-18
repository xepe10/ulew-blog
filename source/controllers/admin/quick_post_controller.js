'use strict';

// Node modules
const Promise = require('bluebird');

module.exports = {

  //
  // Renders the posts page.
  //
  view: (req, res, next) => {
    const I18n = req.app.locals.I18n;
    const Settings = req.app.locals.Settings;
    const Themes = req.app.locals.Themes;

    let templates;

    Promise.resolve()
      // Fetch post templates
      .then(() => Themes.getPostTemplates(Settings.theme))
      .then((result) => templates = result)
      // Render the template
      .then(() => {
        res.render('admin/quick_post', {
          meta: {
            bodyClass: 'quick-post',
            title: I18n.term('quick_post')
          },
          templates: templates,
          scripts: ['/assets/js/quick_post.bundle.js'],
          styles: ['/assets/css/quick_post.css']
        });
      })
      .catch((err) => next(err));
  }

};
