// Per-locale aggregate: one import line per namespace (06 §1). vi is the schema locale.
import catalog from './vi/catalog.json';
import common from './vi/common.json';
import contact from './vi/contact.json';
import home from './vi/home.json';

const messages = { common, home, catalog, contact };

export default messages;
