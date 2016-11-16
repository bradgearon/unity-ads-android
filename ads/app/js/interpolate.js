import _ from 'lodash';

function interpolate(string, params) {
  var parts = string.split('//');
  var result = [parts[0] + '//'];
  _.forEach((parts[1] || '').split(':'), (segment, i) => {
    if (i === 0) {
      result.push(segment);
    } else {
      var segmentMatch = segment.match(/(\w+)(?:[?*])?(.*)/);
      var key = segmentMatch[1];
      result.push(params[key]);
      result.push(segmentMatch[2] || '');
    }
  });
  return result.join('');
};

export default interpolate;
