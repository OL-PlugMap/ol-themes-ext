'use strict';


process.env.PUBLIC_URL = "/assets/"

// Do this as the first thing so that any code reading it knows the right env.
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.BABEL_ENV = process.env.BABEL_ENV || process.env.NODE_ENV;

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on('unhandledRejection', err => {
  throw err;
});

// Ensure environment variables are read.
require('../config/env');

const fs = require('fs-extra');
const chalk = require('chalk');
const webpack = require('webpack');
const config = require('../config/webpack.config.prod');
const paths = require('../config/paths');


const FileSizeReporter = require('react-dev-utils/FileSizeReporter');
const warn = require('./utils/warn');

const measureFileSizesBeforeBuild =
  FileSizeReporter.measureFileSizesBeforeBuild;
const printFileSizesAfterBuild = FileSizeReporter.printFileSizesAfterBuild;

// First, read the current file sizes in build directory.
// This lets us display how much they changed later.
measureFileSizesBeforeBuild(paths.appBuild)
  .then(previousFileSizes => {
    // Remove all content but keep the directory so that
    // if you're in it, you don't end up in Trash
    fs.emptyDirSync(paths.appBuild);
    // Merge with the public folder
    //copyPublicFolder();
    // Start the webpack build
    return build(previousFileSizes);
  })
  .then(
    ({ stats, previousFileSizes, warnings }) => {
      if(!warnings)
        warnings = [];
      if (warnings.length) {
        console.log(chalk.yellow('Compiled with warnings.\n'));
        console.log(warnings.join('\n\n'));
        console.log(
          '\nSearch for the ' +
            chalk.underline(chalk.yellow('keywords')) +
            ' to learn more about each warning.'
        );
        console.log(
          'To ignore, add ' +
            chalk.cyan('// eslint-disable-next-line') +
            ' to the line before.\n'
        );
      } else {
        console.log(chalk.green('Compiled successfully.\n'));
      }

      console.log('File sizes after gzip:\n');
      printFileSizesAfterBuild(stats, previousFileSizes, paths.appBuild);
      console.log();
    },
    err => {
      console.error(chalk.red('Failed to compile.\n'));
      console.error((err.message || err) + '\n');
      process.exit(1);
    }
  );

// Create the production build and print the deployment instructions.
function build(previousFileSizes) {
  const withDebugger = false;
  console.log();
  if (withDebugger) {
    console.log(
      `Creating a ${process.env.NODE_ENV} build with debugger enabled...`
    );
  } else {
    console.log(`Creating an optimized ${process.env.NODE_ENV} build...`);
  }

  let cfg = paths.configureWebpack(config, process.env.NODE_ENV);
  console.log(cfg);
  const compiler = webpack(
    cfg
  );
  return new Promise((resolve, reject) => {
    console.log("Compile start")
    compiler.run((err, stats) => {
      //console.log(stats)
      console.log("Compile end")
      console.log(err)
      console.log(stats)
      if(stats && stats.compilation && stats.compilation.errors && stats.compilation.errors.length)
      {
        return reject(stats.compilation.errors);
      }
      if (err) {
        return reject(err);
      }
      const messages = { errors : [] };
      if (messages.errors.length) {
        return reject(new Error(messages.errors.join('\n\n')));
      }
      if (process.env.CI && messages.warnings.length) {
        console.log(
          chalk.yellow(
            '\nTreating warnings as errors because process.env.CI = true.\n' +
              'Most CI servers set it automatically.\n'
          )
        );
        return reject(new Error(messages.warnings.join('\n\n')));
      }
      return resolve({
        stats,
        previousFileSizes,
        warnings: messages.warnings
      });
    });
  });
}

function copyPublicFolder() {
  fs.copySync(paths.appPublic, paths.appBuild, {
    dereference: true,
    filter: file => file !== paths.appHtml
  });
}
