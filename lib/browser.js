var Q = require('q');
var through2 = require('through2');
var waitForPort = require('wait-for-port');
var docker = require('dockerode')();

exports.runWithBrowserContainer = function(cb) {
  const deferred = Q.defer();

  startBrowserContainer()
  .then(function(container) {
    trackDownloadProgress(container)
    .then(function(progressStream) {
      progressStream.on('data', deferred.notify);
      container.ip = getIp();

      return Q(cb(container))
        .then(() => {
          progressStream.removeAllListeners('data');
          progressStream.on('data', (d) => {
            stopBrowserContainer(container)
            .then(deferred.resolve.bind(null, d))
            .catch(deferred.reject);
          });
        });
    });
  })
  .catch(deferred.reject);

  return deferred.promise;
};

function getIp() {
  if (process.env.DOCKER_HOST) {
    return process.env.DOCKER_HOST.match(/\d+\.\d+\.\d+\.\d+/)[0];
  } else {
    return "127.0.0.1";
  }
}


function startBrowserContainer() {
  const BROWSER_IMAGE = 'selenium/standalone-firefox:latest';

  return pullImage()
    .then(startContainer);


  function pullImage() {
    const deferred = Q.defer();
    docker.pull(BROWSER_IMAGE, function(err) {
      if (err) return deferred.reject(new Error(err));

      deferred.resolve();
    });

    return deferred.promise;
  }

  function startContainer() {
    const deferred = Q.defer();

    docker.createContainer({
      Image: BROWSER_IMAGE,
      Detach: true,
      PortBindings: {
        "4444/tcp": [{ "HostIp": "\"", "HostPort": "4444" }]
      }
    },
    function (err, container) {
      if (err) return deferred.reject(new Error(err));

      container.start(function(err, data) {
        if (err) return deferred.reject(new Error(err));

        process.on('SIGINT', () => {
          stopBrowserContainer(container)
            .finally(process.exit);
        });

        waitForPort(getIp(), 4444, (err) => {
          if (err) return deferred.reject(new Error(err));

          deferred.resolve(container);
        });
      });
    });

    return deferred.promise;
  }
}

function stopBrowserContainer(container) {
  const deferred = Q.defer();

  container.remove({
    force: true
  }, err => {
    if (err) return deferred.reject(new Error(err));

    deferred.resolve();
  });

  return deferred.promise;
}


function trackDownloadProgress(container) {
  const deferred = Q.defer();
  container.stats(function(err, stream) {
    if (err) return deferred.reject(new Error(err));

    deferred.resolve(stream.pipe(through2.obj(function(chunk, enc, callback) {
      const rx_bytes = JSON.parse(chunk.toString()).networks.eth0.rx_bytes;
      this.push(rx_bytes);
      callback();
    })));
  });

  return deferred.promise;
}

