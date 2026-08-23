/**
 * What every screenshot in the guide shows, and how to take it again.
 *
 * The admin keeps changing, so a picture of it is only useful for as long as
 * someone can retake it. Each entry names the screen, the way in, and the
 * elements the figure caption points at — the numbers here are the numbers in
 * that caption.
 *
 *   auth: true   needs a signed-in session, so it is taken through the browser
 *                pane rather than by capture.mjs
 *   up: n        ring the element's n-th ancestor instead — for a control whose
 *                meaningful extent is its whole row
 */

const APP = process.env.GUIDE_APP ?? 'http://localhost:3000'

export const RECIPES = [
  // ---- Chapter 1 · The admin at a glance --------------------------------
  {
    name: '01-login',
    auth: false,
    url: `${APP}/admin/login`,
    width: 1280,
    height: 800,
    clip: { selector: 'form', pad: 56 },
    marks: [
      ['input[type=email]', 1],
      ['input[type=password]', 2],
      ['text=Login', 3],
    ],
  },
  // Below about 1600 the admin folds its sidebar into a hamburger, so every
  // figure meant to show the navigation is taken wider than that.
  {
    name: '01-dashboard',
    auth: true,
    url: `${APP}/admin`,
    width: 1800,
    height: 800,
    marks: [
      ['.nav', 1],
      ['.dashboard', 2],
      ['.app-header__account', 3],
    ],
  },
  {
    name: '01-list-view',
    auth: true,
    url: `${APP}/admin/collections/building-lines`,
    width: 1800,
    height: 500,
    marks: [
      ['.search-filter', 1],
      ['.list-create-new-doc__create-new-button', 2],
      ['.table tbody tr', 3],
    ],
  },
  {
    name: '01-edit-view',
    auth: true,
    url: `${APP}/admin/collections/building-lines`,
    width: 1800,
    height: 620,
    steps: [{ click: '.table tbody tr a' }, { wait: 1500 }],
    marks: [
      ['.step-nav', 1],
      ['text=Save', 2],
      ['.doc-controls .popup-button', 3],
    ],
  },

  // ---- Chapter 2 · Regions ----------------------------------------------
  {
    name: '02-regions-list',
    auth: true,
    url: `${APP}/admin/collections/regions`,
    width: 1800,
    height: 500,
  },
  {
    name: '02-region-edit',
    auth: true,
    url: `${APP}/admin/collections/regions`,
    width: 1800,
    height: 640,
    steps: [{ click: '.table tbody tr a' }, { wait: 1500 }],
    marks: [
      ['#field-name', 1],
      ['#field-code', 2],
      ['text=Save', 3],
    ],
  },

  // ---- Chapter 3 · Product Lines ----------------------------------------
  {
    name: '03-line-edit',
    auth: true,
    url: `${APP}/admin/collections/building-lines`,
    width: 1800,
    height: 1320,
    steps: [{ click: '.table tbody tr a' }, { wait: 1500 }],
    marks: [
      ['#field-name', 1],
      ['#field-unitLabel', 2],
      ['#field-rules', 3],
      ['#field-regions', 4],
    ],
  },
  // ---- Chapter 5 · Room Types -------------------------------------------
  {
    name: '05-room-types-list',
    auth: true,
    url: `${APP}/admin/collections/room-types`,
    width: 1800,
    height: 760,
  },

  // ---- Chapter 6 · Exterior Options -------------------------------------
  // Photographed as a blank form: the collection is empty, and an empty form is
  // the better picture for a chapter about what the fields are anyway.
  {
    name: '06-exterior-option-create',
    auth: true,
    url: `${APP}/admin/collections/exterior-options/create`,
    width: 1800,
    height: 880,
    steps: [{ wait: 1200 }],
    marks: [
      ['#field-title', 1],
      ['#field-model', 2],
      ['#field-price', 3],
      ['#field-description', 4],
    ],
  },

  // ---- Chapter 7 · Furniture Tiers --------------------------------------
  {
    name: '07-tiers-list',
    auth: true,
    url: `${APP}/admin/collections/furniture-tiers`,
    width: 1800,
    height: 500,
  },

  // ---- Chapter 8 · Furniture Packages -----------------------------------
  {
    name: '08-package-edit',
    auth: true,
    url: `${APP}/admin/collections/furniture-packages`,
    width: 1800,
    height: 1100,
    steps: [{ click: '.table tbody tr a' }, { wait: 2500 }],
    marks: [
      ['#field-title', 1],
      ['#field-model', 2],
      ['#field-thumbnail', 3],
    ],
  },

  // ---- Chapter 9 · Media -------------------------------------------------
  {
    name: '09-images-list',
    auth: true,
    url: `${APP}/admin/collections/images`,
    width: 1800,
    height: 560,
  },
  {
    name: '09-models-list',
    auth: true,
    url: `${APP}/admin/collections/models`,
    width: 1800,
    height: 760,
    marks: [
      ['text=Upload a model', 1],
      ['text=Upload a model folder', 2],
    ],
  },
  {
    name: '09-model-edit',
    auth: true,
    url: `${APP}/admin/collections/models`,
    width: 1800,
    height: 1000,
    steps: [{ click: '.table tbody tr a' }, { wait: 3000 }],
    marks: [['#field-title', 1]],
  },
  {
    name: '09-textures-list',
    auth: true,
    url: `${APP}/admin/collections/textures`,
    width: 1800,
    height: 500,
  },

  // ---- Chapter 10 · Users -----------------------------------------------
  {
    name: '10-users-list',
    auth: true,
    url: `${APP}/admin/collections/users`,
    width: 1800,
    height: 460,
  },
  {
    name: '10-user-create',
    auth: true,
    url: `${APP}/admin/collections/users/create`,
    width: 1800,
    height: 640,
    steps: [{ wait: 1200 }],
    marks: [
      ['#field-email', 1],
      ['#field-password', 2],
    ],
  },

  // ---- Chapter 11 · Configurator settings --------------------------------
  // The admin renders only the open tab's fields and remembers which tab that
  // was, so each of these opens the one it means to photograph.
  {
    name: '11-settings-page',
    auth: true,
    url: `${APP}/admin/globals/configurator-settings`,
    width: 1800,
    height: 900,
    steps: [{ wait: 1800 }, { click: 'text=Page' }, { wait: 800 }],
    marks: [
      ['.tabs-field__tabs', 1],
      ['#field-logo', 2],
      ['#field-meta', 3],
    ],
  },
  {
    name: '11-settings-quiz',
    auth: true,
    url: `${APP}/admin/globals/configurator-settings`,
    width: 1800,
    height: 1000,
    steps: [{ wait: 1800 }, { click: 'text=Quiz' }, { wait: 800 }],
  },

  {
    name: '08-package-visitor',
    auth: false,
    url: `${APP}/configurator?building=boxxplex&offices=2&restrooms=0`,
    width: 1440,
    height: 900,
    // The scene opens from above with a labelled pill over each room. The pill is
    // ordinary markup floating on the canvas, so it can be selected by its text —
    // the rooms themselves are pixels and could not be.
    steps: [{ wait: 9000 }, { click: 'text=Room 1' }, { wait: 4000 }],
  },
  {
    name: '05-room-type-visitor',
    auth: false,
    url: `${APP}/configurator?building=boxxplex&offices=2&restrooms=0`,
    width: 1440,
    height: 900,
    steps: [{ wait: 9000 }, { click: 'text=Room 1' }, { wait: 4000 }],
    clip: { selector: 'header', pad: 24 },
  },

  {
    name: '03-quiz-step1',
    auth: false,
    url: `${APP}/configurator`,
    width: 1120,
    height: 900,
    clip: { selector: 'form', pad: 40 },
    marks: [['[role=radiogroup]']],
  },
  {
    name: '03-quiz-step2',
    auth: false,
    url: `${APP}/configurator`,
    width: 1120,
    height: 900,
    clip: { selector: 'form', pad: 40 },
    steps: [{ click: '[role=radio]' }, { wait: 600 }],
    marks: [
      ['text=BOXXPlex', 1],
      ['button[aria-label="Increase Offices"]', 2, { up: 2 }],
      ['button[aria-label="Increase Restrooms"]', 3, { up: 2 }],
    ],
  },
]
