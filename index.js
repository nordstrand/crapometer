var assert = require('assert');
var fs = require('fs');
var wd = require('wd');
var Q = require('q');
var term = require( 'terminal-kit' ).terminal;
var bytes = require('bytes');
var sprintf = require('sprintf-js').sprintf;

var runWithBrowserContainer = require('./lib/browser').runWithBrowserContainer;

function main(url) {
  assert(url, 'URL to measure must be defined')

  runWithBrowserContainer(getUrl.bind(null, url))
  .progress((downloadedBytes) => {
    var text = sprintf("'%s' page weight: %-10s ", url, bytes(downloadedBytes));
    term.column(1, text)
        //.hideCursor();
  })
  .then(function (unfilteredbytes) {
    return runWithBrowserContainer((container) => {
      return uploadHostsFile(container, './hosts').then(getUrl.bind(null, url, container));
    })
    .progress((downloadedBytes) => {
      var text = sprintf("of which %.1f%% is crap.  ",
          (100 * (unfilteredbytes - downloadedBytes)) / unfilteredbytes);
      term(text).left(text.length);
    })
    .finally(() => {
      term.nextLine()
        //.hideCursor();
      console.error('Done');
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

main(process.argv[2])


function getUrl(url, container) {
  var browser = wd.promiseChainRemote({hostname: container.ip});

  return browser
  .init({browserName:'firefox'})
  .get(url)
//  .takeScreenshot().then(function(res) {
//     var data = new Buffer(res, 'base64');
//     fs.writeFileSync('site.png', data);
//  })
  .finally(() => { console.error('Browser quit'); return browser.quit(); })
}

function uploadHostsFile(container, file) {
  const deferred = Q.defer();

	container.exec({
    Cmd: ['bash', '-c', 'cat - > /etc/hosts'],
    AttachStdin: true,
    User: 'root'
  },(err, exec) => {
    exec.start({hijack: true, stdin: true}, (err, stream) => {
      fs.createReadStream('./hosts', 'binary')
      .on('end', deferred.resolve)
      .pipe(stream);
    });
  });

  return deferred.promise;
}


