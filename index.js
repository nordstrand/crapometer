var assert = require('assert');
var fs = require('fs');

var wd = require('wd');
var Q = require('q');
var term = require( 'terminal-kit' ).terminal;
var bytes = require('bytes');
var sprintf = require('sprintf-js').sprintf;

var runWithBrowserContainer = require('./lib/browser').runWithBrowserContainer;
var injectHostsFile = require('./lib/hosts'); 

function main(url) {
  assert(url, 'URL to measure must be defined');

  function logPageWeight(b) {
    var text = sprintf("'%s' page weight: %-10s ", url, bytes(b));
    term.column(1, text);
      //.hideCursor();
   }

  function logCrapRate(crappyBytes, nonCrapBytes) {
    var text = sprintf("of which %.0f%% is crap.  ",
        (100 * (Math.max(0, crappyBytes - nonCrapBytes))) / crappyBytes);
    term(text).left(text.length);
  }

  runWithBrowserContainer(getUrl.bind(null, url))
  .progress(logPageWeight)
  .then((unfilteredbytes) => {
    logPageWeight(unfilteredbytes);

    return runWithBrowserContainer(container => {
      return injectHostsFile(container).then(getUrl.bind(null, url, container));
    })
    .progress(logCrapRate.bind(null, unfilteredbytes))
    .then(logCrapRate.bind(null, unfilteredbytes))
    .finally(() => {
      term.nextLine();
        //.hideCursor();
    });
  })
  .catch((error) =>  {
    console.log("ERROR:", error);
  })
  .finally(() => {
    term.nextLine()
        .showCursor();
    console.error('Done');
  });
}

main(process.argv[2]);


function getUrl(url, container) {
  const browser = wd.promiseChainRemote({hostname: container.ip});

  return browser
  .init({browserName:'firefox'})
  .get(url)
//  .takeScreenshot().then(function(res) {
//     var data = new Buffer(res, 'base64');
//     fs.writeFileSync('site.png', data);
//  })
  .finally(() => { return browser.quit(); });
}



