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
  if(!langConfig.title){
    langConfig.title = defaultConfig.title;
  }

  if(!langConfig.replace) {
    langConfig.replace = defaultConfig.replace;
  }
  if(!langConfig.remove) {
    langConfig.remove = defaultConfig.remove;
  }

  _.forEach(fs.readdirSync(wordDir), file => {
    var location = file.split('-');
    var book = null;
    var offset = 0;
    var version = langConfig.version;

    // loop through old testament and new testament
    do {
      book = _.find(books[offset++], {abbr: location[0]});
    } while(!book);

    if(_.isArray(version)) {
      version = version[offset - 1];
    }

    var data = {
      abbr: location[0],
      chapter: location[1],
      verse: location[2],
      version: version,
      ord: book.ord,
      name: book.name.replace(' ', '-').toLowerCase()
    };

    var esv = jsonfile.readFileSync(wordDir + file + '/esv' + '.json');

    var lastVerse = _.last(esv.verse.match(/(\d+)/g));
    var readUrl = interpolate(langConfig.url, _.clone(data));

    if(!langConfig.useIds) {
      readUrl += ':' + data.verse + '-' + lastVerse;
    }

    console.log(readUrl + '\n');
    console.log(esv.verse + '\n');

    var page = request('get', readUrl).getBody('utf8');
    var $ = cheerio.load(page);

    if(langConfig.remove) {
      $(langConfig.remove).remove();
    }

    var body = $(langConfig.content);

    if(langConfig.useIds) {
      // stop after the last verse (on the next one)
      var $contents = $(langConfig.content)
        .children()
        .contents();

      var inRange = false;
      var done = false;

      var first = _.toNumber(data.verse);
      var last = _.toNumber(lastVerse);

      $contents = _.filter($contents, (child) => {
        if(done) {
          return false;
        }

        var id = _.get(child, 'attribs.id');
        var verseNumber = $(child).text();
        
        if(!id) {
          return inRange;
        }

        var verse = _.toNumber(id.replace('v', ''));
        done = verse == last + 1;

        inRange = verse >= first && verse <= last;
        if(langConfig.replace != false) {
          $(child).text($(child).text() + " ");
        }

        return inRange;
      });

      console.log($contents);

      body = $($contents);
    }

    var title = $(langConfig.title).first().text();
    var replaced = body.text().replace(/\n/g, '');

    if(langConfig.replace) {
      replaced = replaced.replace(/([\W]?)(\d+)(.?)/gi, langConfig.replace);
    }

    replaced = replaced.replace(/\s\s+/g, ' ');
    replaced = replaced.trim();
    console.log(replaced + '\n\n');

    var word = {
      verse: replaced,
      title: title
    };

    jsonfile.writeFileSync(wordDir + file + '/' + version + '.json',
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
