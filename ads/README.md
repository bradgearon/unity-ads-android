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

### values:

1. content: selector for main content elements (rendered using $.text)
1. title: selector for title element (first rendered using $.text)
1. remove: selector for elements to remove
1. replace: replacement for spaces between sentences and verse numbers

````json
{
  "url":"https://www.biblegateway.com/passage/?version=:version&search=:abbr+:chapter",
  "content":".result-text-style-normal p",
  "title": ".result-text-style-normal h3",
  "remove": ".publisher-info-bottom, .footnote",
  "replace": "$1 $2 $3"
}
````

1. execute the following

````bash
gulp lang --add {culture code}
````
