'use strict';

import cleaner from 'unfluff/lib/cleaner';
import config from '../config';
import interpolate from '../../app/js/interpolate';
import _ from 'lodash';
import request from 'sync-request';
import args from 'minimist';
import jsonfile from 'jsonfile';
import fs from 'fs';
import cheerio from 'cheerio';

const knownOptions = {
  string: 'env',
  default: { env: process.env.NODE_ENV || 'production' }
};

const options = args(process.argv.slice(2), knownOptions);

function addLang(options) {
  var dataDir = config.sourceDir + 'data/';
  var configDir = dataDir + 'config/';
  var wordDir = dataDir + 'word/';

  var defaultConfig = jsonfile.readFileSync(configDir + 'default.json');
  var books = jsonfile.readFileSync(dataDir + 'books.json');
  var langConfig = jsonfile.readFileSync(configDir + options.add + '.json');
  if(!langConfig.url) {
    langConfig.url = defaultConfig.url;
  }
  if(!langConfig.content) {
    langConfig.content = defaultConfig.content;
  }

  _.forEach(fs.readdirSync(wordDir), file => {
    var location = file.split('-');
    var book = _.find(books, {abbr: location[0]});
    var data = {
      abbr: location[0],
      chapter: location[1],
      verse: location[2],
      version: langConfig.version,
      ord: book.ord
    };

    var esv = jsonfile.readFileSync(wordDir + file + '/esv' + '.json');

    var lastVerse = _.last(esv.verse.match(/(\d+)/g));
    var readUrl = interpolate(langConfig.url, data)
      + ':' + data.verse + '-' + lastVerse;
    console.log(readUrl + '\n');

    console.log(esv.verse + '\n');

    var page = request('get', readUrl).getBody('utf8');
    var $ = cheerio.load(page);
    if(langConfig.remove) {
      $(langConfig.remove).remove();
    }

    var body = $(langConfig.content);
    var replaced = body.text()
      .replace(/([0-9-]*[0-9][-†]?)([\w“])/gi, '$1 $2')
      .trim();

    console.log(replaced + '\n\n');
    var word = {
      verse: replaced,
      title: ''
    };

    jsonfile.writeFileSync(wordDir + file + '/' + options.add + '.json',
      word, {spaces: 2});
  });

}


function buildJson() {
  console.log(options);
  if(options.add) {
    addLang(options);
  }

}

buildJson();
