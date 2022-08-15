import classic from 'ember-classic-decorator';
import ApplicationAdapter from './application';

@classic
export default class Track extends ApplicationAdapter {
  namespace = 'api';

  urlForQuery(query) {
    console.log(query);
    let djId = query.dj;
    let page = query.page || 1;
    return `${this.urlPrefix()}/djs/${djId}/tracks?page=${page}`;
  }
}
