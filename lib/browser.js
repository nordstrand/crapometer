var Q = require('q');
var through2 = require('through2');
var waitForPort = require('wait-for-port');
var docker = require('dockerode')();

exports.runWithBrowserContainer = function(cb) {
  var deferred = Q.defer();

  startBrowserContainer()
  .then(function(container) {
    trackDownloadProgress(container)
    .then(function(progressStream) {
      var data;
      progressStream.on('end', function() { deferred.resolve(data);});
      progressStream.on('data', function(d) { data = d; deferred.notify(d);});

      return Q(cb(container)).then(stopBrowserContainer.bind(null, container));
    });
  });

  return deferred.promise;
}

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

