var assert = require('assert');
var fs = require('fs');
var wd = require('wd');
var docker = require('dockerode')();
var Q = require('q');
var waitForPort = require('wait-for-port');
var through2 = require('through2');
var term = require( 'terminal-kit' ).terminal;
var bytes = require('bytes');
var sprintf = require('sprintf-js').sprintf;

function main(url) {
  assert(url, 'URL to measure must be defined')

  runWithBrowserContainer(getUrl.bind(null, url))
  .progress(function(downloadedBytes) {
    var text = sprintf("'%s' page weight: %-10s ", url, bytes(downloadedBytes));
    term.column(1, text)
        //.hideCursor();
  })
  .then(function (unfilteredbytes) {
    return runWithBrowserContainer(function(container) {
      return uploadHostsFile(container, './hosts').then(getUrl.bind(null, url));
    })
    .progress(function(downloadedBytes) {
      var text = sprintf("of which %.1f%% is crap.  ",
          (100 * (unfilteredbytes - downloadedBytes)) / unfilteredbytes);
      term(text).left(text.length);
    })
    .finally(function() {
      term.nextLine()
        //.hideCursor();
      console.error('Done');
    });
  })
  .catch(function(error) {
    console.log("ERROR:", error);
  })
  .finally(function() {
    term.nextLine()
        .showCursor();
    console.error('Done');
  });
}

main(process.argv[2])

function startBrowserContainer() {
  var deferred = Q.defer();
  docker.createContainer({
    Image: 'selenium/standalone-firefox',
    Detach: true,
    PortBindings: {
      "4444/tcp": [{ "HostIp": "\"", "HostPort": "4444" }]
    }
  },
  function (err, container) {
    if (err) return deferred.reject(new Error(err));

    container.start(function(err, data) {
      if (err) return deferred.reject(new Error(err));

      process.on('SIGINT', function() {
        stopBrowserContainer(container)
        .finally(process.exit);
      });

      waitForPort('192.168.99.100', 4444, function(err) {
        if (err) return deferred.reject(new Error(err));

        console.error(container)
        deferred.resolve(container);
      });
    });
  });

  return deferred.promise;
}

function statsstream() {
  return through2.obj(function (chunk, enc, callback) {
    var object = JSON.parse(chunk.toString()).networks.eth0.rx_bytes;

    term.column(1, sprintf('Page weight: %-10s_', bytes(object)));
    this.push(object);
    callback();
  });
}

function getUrl(url) {
  var browser = wd.promiseChainRemote({hostname: '192.168.99.100'});

  return browser
  .init({browserName:'firefox'})
  .get(url)
//  .takeScreenshot().then(function(res) {
//     var data = new Buffer(res, 'base64');
//     fs.writeFileSync('site.png', data);
//  })
  .finally(function() { console.error('Browser quit'); return browser.quit(); })
}

function stopBrowserContainer(container) {
  var deferred = Q.defer();

  container.remove({
    force: true
  }, function(err) {
    if (err) return deferred.reject(new Error(err));

    console.error("Container removed");
    deferred.resolve();
  });

  return deferred.promise;
}

function uploadHostsFile(container, file) {
  var deferred = Q.defer();

	container.exec({
    Cmd: ['bash', '-c', 'cat - > /etc/hosts'],
    AttachStdin: true,
    User: 'root'
  }, function(err, exec) {
    exec.start({hijack: true, stdin: true}, function(err, stream) {
      fs.createReadStream('./hosts', 'binary')
      .on('end', deferred.resolve)
      .pipe(stream);
    });
  });

  return deferred.promise;
}


function runWithBrowserContainer(cb) {

  var deferred = Q.defer();

  startBrowserContainer()
  .then(function(container) {
    trackDownloadProgress(container)
    .then(function(progressStream) {
      var data;
      progressStream.on('end', function() { deferred.resolve(data);});
      progressStream.on('data', function(d) { data = d; deferred.notify(d);});

      return Q(cb(container))
      .then(stopBrowserContainer.bind(null, container));
    });
  });

  return deferred.promise;
}

function trackDownloadProgress(container) {
  var d = Q.defer();
  container.stats(function(err, stream) {
    if (err) return d.reject(new Error(err));

    d.resolve(stream.pipe(through2.obj(function (chunk, enc, callback) {
      var rx_bytes = JSON.parse(chunk.toString()).networks.eth0.rx_bytes;
      this.push(rx_bytes);
      callback();
    })));

  });

  return d.promise;
}




/*
start ()
{
    docker rm -f firefox;
    docker run -d -p 4444:4444 --name firefox selenium/standalone-firefox
}
jonte@air:~/DEV/crapometer  (master)$ type run
run is a function
run ()
{
    node index.js $1
}
jonte@air:~/DEV/crapometer  (master)$ type stats
stats is a function
stats ()
{
    docker stats --no-stream firefox
}
jonte@air:~/DEV/crapometer  (master)$ type hosts
hosts is a function
hosts ()
{
    cat hosts | docker exec -i -u root firefox bash -c 'cat - > /etc/hosts'
}
jonte@air:~/DEV/crapometer  (master)$ restart > /dev/null;  hosts; sleep 1; run http://www.dn.no; stats
 */
