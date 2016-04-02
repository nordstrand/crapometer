var fs = require('fs');
var path = require('path');

var Q = require('q');
var got = require('got');

module.exports = function(container) {
    const deferred = Q.defer();

    container.exec({
      Cmd: ['bash', '-c', 'cat - > /etc/hosts'],
      AttachStdin: true,
      User: 'root'
    },(err, exec) => {
      exec.start({hijack: true, stdin: true}, (err, stream) => {
        getHostFile()
        .then(readStream => {
          readStream
            .on('end', deferred.resolve)
            .pipe(stream);
        })
        .catch(deferred.reject);
      });
    });

    return deferred.promise;
};

function getHostFile() {
  const HOSTS_FILE_URL = 'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts',
  tmpFileName = 'crap-hosts.' + new Date().toDateString().replace(/\W/g, '_'),
  tmpPath = path.resolve(require('os').tmpdir(), tmpFileName),
  streamFile = () => { return fs.createReadStream(tmpPath, 'binary'); },
  deferred = Q.defer();

  if (fs.existsSync(tmpPath)) {
    deferred.resolve(streamFile());
  } else {
    got.stream(HOSTS_FILE_URL)
      .pipe(fs.createWriteStream(tmpPath))
      .on('finish', () => { deferred.resolve(streamFile()); })
      .on('error', err => { deferred.reject(err); });
  }

  return deferred.promise;
};


