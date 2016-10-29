## building

````bash
gulp prod
````

## adding a language

1. obtain the two letter culture code for the language
1. find a version in the language
1. add version to app/data/culture.json
  * example `{ "en": "esv" }`
1. add language config to app/data/config/{culture code}.json

````json
{
  "url":"https://www.biblegateway.com/passage/?version=:version&search=:abbr+:chapter",
  // selector for main content elements (rendered using $.text)
  "content":".result-text-style-normal p",
  // selector for title element (first rendered using $.text)
  "title": ".result-text-style-normal h3",
  // selector for elements to remove
  "remove": ".publisher-info-bottom, .footnote",
  // replacement for spaces between sentences and verse numbers
  "replace": "$1 $2 $3"
}
````

1. execute the following

````bash
gulp lang --add {culture code}
````
