var winston = require('winston'),
    util = require('util'),
    posix = require('posix'),
    os = require('os'),
    JOT = require('javascript-object-templates'),
    btoa = require('btoa');


// var npmToSyslogLevels = { error: 3, warn: 4, info: 5, verbose: 6, debug: 7, silly: 7 }


// For reference:
//
// sysLogLevels = {  0 :"Emergency: system is unusable",
//             1 :"Alert: action must be taken immediately",
//             2 :"Critical: critical conditions",
//             3 :"Error: error conditions",
//             4 :"Warning: warning conditions",
//             5 :"Notice: normal but significant condition",
//             6 :"Informational: informational messages",
//             7 :"Debug: debug-level messages"}

var messageTemplate = {
    "version": "1.1",
    "host": os.hostname(),
    "short_message": "",
    "full_message": "",
    "timestamp": 0.0,
    "level": 3
}


function escape(key, val) {
    if (typeof(val) != "string") return val
    return val
        .replace(/[\n]/g, '#012')
        .replace(/[\r]/g, '#015')
}

function formatMessage(short_message, full_message) {
    var gelf = new JOT(messageTemplate)
    gelf.merge({
        "short_message": short_message,
        "full_message": full_message,
        timestamp: Date.now() / 1000
    })

    var cee = {
        time: gelf.get('timestamp'),
        msg: btoa(gelf.getObject())
    }
    return '@cee: ' + JSON.stringify(cee, escape)
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
        } else {
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
        message = formatMessage(this.id, message)

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