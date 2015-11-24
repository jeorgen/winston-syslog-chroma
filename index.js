var winston = require('winston'),
    util = require('util'),
    posix = require('posix'),
    os = require('os'),
    JOT = require('javascript-object-templates');

var messageTemplate = {
    "version": "1.1",
    "host": os.hostname(),
    "short_message": "",
    "full_message": "",
    "timestamp": 0.0,
    "level": 3}

function formatMessage(message) {
    var gelf = new JOT(messageTemplate)
    gelf.merge({
        "short_message": message.substring(0, 20),
        "full_message": message,
        timestamp: Date.now() / 1000
    })

    var cee =  {time: gelf.get('timestamp'), msg: gelf.getObject()}
    return '@cee: ' + JSON.stringify(cee)
}


function SyslogTransport(options) {
    options = options || {};
    winston.Transport.call(this, options);
    this.id = options.id || process.title;
    this.facility = options.facility || 'local0';
    this.showPid = !!options.showPid;
}

util.inherits(SyslogTransport, winston.Transport);

util._extend(SyslogTransport.prototype, {
    name: 'syslog',
    log: function(level, msg, meta, callback) {
        if (this.silent) {
            callback(null, true);
            return;
        }

        var syslogSeverity = level;
        if (level === 'error') {
            syslogSeverity = 'err';
        } else if (level === 'warn') {
            syslogSeverity = 'warning';
        } else if (level === 'trace') {
            syslogSeverity = 'debug';
        }
        else {
            syslogSeverity = 'debug';
        }

        var message = msg,
            prepend = '[' + level + '] ';
        if (typeof(meta) === 'string') {
            message += ' ' + meta;
        } else if (meta && typeof(meta) === 'object' && Object.keys(meta).length > 0) {
            message += ' ' + util.inspect(meta, false, null, false);
        }

        // message = message.replace(/\u001b\[(\d+(;\d+)*)?m/g, '');
        message = formatMessage(message)

        //truncate message to a max of 20000 bytes
        //we'll just use characters though, because that's easier
        //plus splitting a 3-byte character into less than 3-bytes
        //wouldn't make a lot of sense anyway
        var messages = [];

        var maxLength = 20000;
        while (message.length > maxLength) {
            messages.push(message.substring(0, maxLength));
            message = message.substring(maxLength);
        }

        messages.push(message);

        var options = {
            cons: true,
            pid: this.showPid
        };
        posix.openlog(this.id, options, this.facility);
        messages.forEach(function(message) {
            posix.syslog(syslogSeverity, message);
        });
        posix.closelog();

        callback(null, true);
    }
});

module.exports = SyslogTransport;