import _ from 'lodash';
import CircularProgress from '@material-ui/core/CircularProgress';
import ExpandableTable from './ExpandableTable.jsx';
import Grid from '@material-ui/core/Grid';
import PropTypes from 'prop-types';
import React from 'react';
import { withContext } from './util/AppContext.jsx';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import { withStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import { directionColumn, srcDstColumn } from './util/TapUtils.jsx';
import { formatLatencySec, formatWithComma } from './util/Utils.js';

// https://godoc.org/google.golang.org/grpc/codes#Code
const grpcStatusCodes = {
  0: "OK",
  1: "Canceled",
  2: "Unknown",
  3: "InvalidArgument",
  4: "DeadlineExceeded",
  5: "NotFound",
  6: "AlreadyExists",
  7: "PermissionDenied",
  8: "ResourceExhausted",
  9: "FailedPrecondition",
  10: "Aborted",
  11: "OutOfRange",
  12: "Unimplemented",
  13: "Internal",
  14: "Unavailable",
  15: "DataLoss",
  16: "Unauthenticated"
};

const spinnerStyles = theme => ({
  progress: {
    margin: theme.spacing.unit * 2,
  },
});
const SpinnerBase = () => <CircularProgress size={20} />;
const Spinner = withStyles(spinnerStyles)(SpinnerBase);

const httpStatusCol = {
  title: "HTTP status",
  key: "http-status",
  render: datum => {
    let d = _.get(datum, "responseInit.http.responseInit");
    return !d ? <Spinner /> : d.httpStatus;
  }
};

const responseInitLatencyCol = {
  title: "Latency",
  key: "rsp-latency",
  isNumeric: true,
  render: datum => {
    let d = _.get(datum, "responseInit.http.responseInit");
    return !d ? <Spinner /> : formatTapLatency(d.sinceRequestInit);
  }
};

const grpcStatusCol = {
  title: "GRPC status",
  key: "grpc-status",
  render: datum => {
    let d = _.get(datum, "responseEnd.http.responseEnd");
    return !d ? <Spinner /> :
      _.isNull(d.eos) ? "---" : grpcStatusCodes[_.get(d, "eos.grpcStatusCode")];
  }
};

const pathCol = {
  title: "Path",
  key: "path",
  render: datum => {
    let d = _.get(datum, "requestInit.http.requestInit");
    return !d ? <Spinner /> : d.path;
  }
};

const methodCol = {
  title: "Method",
  key: "method",
  render: datum => {
    let d = _.get(datum, "requestInit.http.requestInit");
    return !d ? <Spinner /> : _.get(d, "method.registered");
  }
};

const topLevelColumns = (resourceType, ResourceLink) => [
  {
    title: "Direction",
    key: "direction",
    render: d => directionColumn(d.base.proxyDirection)
  },
  {
    title: "Name",
    key: "src-dst",
    render: d => {
      let datum = {
        direction: _.get(d, "base.proxyDirection"),
        source: _.get(d, "base.source"),
        destination: _.get(d, "base.destination"),
        sourceLabels: _.get(d, "base.sourceMeta.labels", {}),
        destinationLabels: _.get(d, "base.destinationMeta.labels", {})
      };
      return srcDstColumn(datum, resourceType, ResourceLink);
    }
  }
];

const tapColumns = (resourceType, ResourceLink) => {
  return _.concat(
    topLevelColumns(resourceType, ResourceLink),
    [ methodCol, pathCol, responseInitLatencyCol, httpStatusCol, grpcStatusCol ]
  );
};

const formatTapLatency = str => {
  return formatLatencySec(str.replace("s", ""));
};

const requestInitSection = d => (
  <React.Fragment>

    <Typography variant="h6">Request Init</Typography>
    <br />
    <List>
      <ListItem>
        <ListItemText primary="Authority" secondary={_.get(d, "requestInit.http.requestInit.authority")} />
      </ListItem>
      <ListItem>
        <ListItemText primary="Path" secondary={_.get(d, "requestInit.http.requestInit.path")} />
      </ListItem>
      <ListItem>
        <ListItemText primary="Scheme" secondary={_.get(d, "requestInit.http.requestInit.scheme.registered")} />
      </ListItem>
      <ListItem>
        <ListItemText primary="Method" secondary={_.get(d, "requestInit.http.requestInit.method.registered")} />
      </ListItem>
      <ListItem>
        <ListItemText primary="TLS" secondary={_.get(d, "base.tls")} />
      </ListItem>
    </List>

  </React.Fragment>
);

const responseInitSection = d => _.isEmpty(d.responseInit) ? null : (
  <React.Fragment>
    <Typography variant="h6">Response Init</Typography>
    <br />
    <List>
      <ListItem>
        <ListItemText primary="HTTP Status" secondary={_.get(d, "responseInit.http.responseInit.httpStatus")} />
      </ListItem>
      <ListItem>
        <ListItemText primary="Latency" secondary={formatTapLatency(_.get(d, "responseInit.http.responseInit.sinceRequestInit"))} />
      </ListItem>
    </List>
  </React.Fragment>
);

const responseEndSection = d => _.isEmpty(d.responseEnd) ? null : (
  <React.Fragment>
    <Typography variant="h6">Response End</Typography>
    <br />

    <List>
      <ListItem>
        <ListItemText primary="GRPC Status" secondary={_.isNull(_.get(d, "responseEnd.http.responseEnd.eos")) ? "N/A" : grpcStatusCodes[_.get(d, "responseEnd.http.responseEnd.eos.grpcStatusCode")]} />
      </ListItem>
      <ListItem>
        <ListItemText primary="Latency" secondary={formatTapLatency(_.get(d, "responseEnd.http.responseEnd.sinceResponseInit"))} />
      </ListItem>
      <ListItem>
        <ListItemText primary="Response Length (B)" secondary={formatWithComma(_.get(d, "responseEnd.http.responseEnd.responseBytes"))} />
      </ListItem>
    </List>
  </React.Fragment>
);

// hide verbose information
const expandedRowRender = d => {
  return (
    <Grid container className="tap-more-info">
      <Grid item xs={4}>
        {requestInitSection(d)}
      </Grid>
      <Grid item xs={4}>
        {responseInitSection(d)}
      </Grid>
      <Grid item xs={4}>
        {responseEndSection(d)}
      </Grid>
    </Grid>
  );
};

class TapEventTable extends React.Component {
  static propTypes = {
    api: PropTypes.shape({
      ResourceLink: PropTypes.func.isRequired,
    }).isRequired,
    resource: PropTypes.string,
    tableRows: PropTypes.arrayOf(PropTypes.shape({})),
  }

  static defaultProps = {
    resource: "",
    tableRows: []
  }

  render() {
    const { tableRows, resource, api } = this.props;
    let resourceType = resource.split("/")[0];
    let columns = tapColumns(resourceType, api.ResourceLink);

    return (
      <ExpandableTable
        tableRows={tableRows}
        tableColumns={columns}
        expandedRowRender={expandedRowRender}
        tableClassName="metric-table" />
    );
  }
}

export default withContext(TapEventTable);
