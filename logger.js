var Logger = {
    debug: function(text) {
        console.log(new Date()+' '+text);
    },
    error: function(text) {
        console.error(new Date()+' '+text);
    }
};

module.exports = Logger;