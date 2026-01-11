import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Dimensions, ScrollView } from 'react-native';
import Svg, { Line, Circle, Polyline, Text as SvgText } from 'react-native-svg';
import Api from '../api/Api';
import styles from './styles';
import { COLORS, SPACING } from './variables';

function fmt(ts) {
  try { return new Date(ts).toLocaleString(); } catch (e) { return ts; }
}

function formatDate(ts) {
  try { 
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  } catch (e) { return 'N/A'; }
}

export default function UsageScreen({ token, onBack }) {
  const [items, setItems] = useState([]);
  const screenWidth = Dimensions.get('window').width - 40;

  useEffect(() => {
    let mounted = true;
    let stopped = false;
    async function load() {
      try {
        const data = await Api.getUsage(token);
        if (mounted) {
          // show oldest first for graph
          const h = (data.history || []);
          setItems(h);
        }
      } catch (e) {
        // ignore load errors during polling
      }
    }
    load();
    const id = setInterval(() => { if (!stopped) load(); }, 5000);
    return () => { stopped = true; mounted = false; clearInterval(id); };
  }, [token]);

  // pull-to-refresh
  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try { await Api.getUsage(token).then(d => setItems(d.history || [])); } catch(e){}
    setRefreshing(false);
  };

  // Generate graph data
  const generateGraphPoints = () => {
    if (items.length < 2) return null;
    
    const graphWidth = screenWidth - 20;
    const graphHeight = 250;
    const padding = 40;
    
    // Get cubic meters values, filter out nulls
    const values = items.map(item => item.cubicMeters ?? 0).filter(v => v !== null);
    if (values.length === 0) return null;
    
    const maxValue = Math.max(...values, 100);
    const minValue = 0;
    const range = maxValue - minValue;
    
    // Calculate points
    const points = values.map((value, idx) => {
      const x = padding + (idx / (values.length - 1)) * (graphWidth - padding * 2);
      const y = graphHeight - ((value - minValue) / range) * (graphHeight - padding * 2);
      return { x, y, value, idx };
    });
    
    return { points, graphWidth, graphHeight, padding, maxValue };
  };

  const graphData = generateGraphPoints();

  return (
    <View style={{ padding: SPACING.base, flex: 1, backgroundColor: COLORS.background }}>
      <TouchableOpacity onPress={onBack} style={{ marginBottom: SPACING.small }}>
        <Text style={{ color: COLORS.link }}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Usage History</Text>

      {items.length === 0 ? (
        <Text style={styles.subtitle}>No readings available yet.</Text>
      ) : graphData ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Graph */}
          <View style={{ marginVertical: SPACING.large, backgroundColor: 'rgba(0, 180, 255, 0.05)', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: 'rgba(0, 180, 255, 0.2)' }}>
            <Svg width={screenWidth} height={graphData.graphHeight + 20} viewBox={`0 0 ${graphData.graphWidth} ${graphData.graphHeight}`}>
              {/* Grid lines */}
              <Line x1={graphData.padding} y1="10" x2={graphData.padding} y2={graphData.graphHeight - graphData.padding} stroke="rgba(0, 180, 255, 0.2)" strokeWidth="1" />
              <Line x1={graphData.padding} y1={graphData.graphHeight - graphData.padding} x2={graphData.graphWidth - 10} y2={graphData.graphHeight - graphData.padding} stroke="rgba(0, 180, 255, 0.2)" strokeWidth="1" />
              
              {/* Y-axis labels */}
              <SvgText x={graphData.padding - 10} y="20" fontSize="12" fill={COLORS.text} textAnchor="end">{graphData.maxValue.toFixed(1)}</SvgText>
              <SvgText x={graphData.padding - 10} y={graphData.graphHeight - graphData.padding + 5} fontSize="12" fill={COLORS.text} textAnchor="end">0</SvgText>
              
              {/* Line graph */}
              {graphData.points.length > 1 && (
                <Polyline
                  points={graphData.points.map(p => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke={COLORS.glowBlue}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              
              {/* Data point circles */}
              {graphData.points.map((point, idx) => (
                <Circle
                  key={idx}
                  cx={point.x}
                  cy={point.y}
                  r="4"
                  fill={COLORS.glowBlue}
                  opacity="0.8"
                />
              ))}
            </Svg>
          </View>

          {/* Stats Summary */}
          <View style={{ marginBottom: SPACING.large }}>
            <Text style={{ color: COLORS.text, fontSize: 14, marginBottom: SPACING.small }}>
              Latest: {items[items.length - 1].cubicMeters?.toFixed(6) ?? '—'} m³
            </Text>
            <Text style={{ color: COLORS.text, fontSize: 14 }}>
              Total Readings: {items.length}
            </Text>
          </View>

          {/* Detailed list below graph */}
          <Text style={{ ...styles.subtitle, marginBottom: SPACING.small }}>All Readings</Text>
          {items.slice().reverse().map((item, idx) => (
            <View key={idx} style={styles.cardSmall}>
              <Text style={{ fontWeight: '700', color: COLORS.text }}>{fmt(item.timestamp)}</Text>
              <Text style={styles.subtitle}>Cubic Meters: {item.cubicMeters?.toFixed(6) ?? '—'}</Text>
              <Text style={styles.subtitle}>Total Liters: {item.totalLiters ?? '—'}</Text>
            </View>
          ))}
        </ScrollView>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, idx) => String(idx)}
          refreshing={refreshing}
          onRefresh={onRefresh}
          renderItem={({ item }) => (
            <View style={styles.cardSmall}>
              <Text style={{ fontWeight: '700', color: COLORS.text }}>{fmt(item.timestamp)}</Text>
              <Text style={styles.subtitle}>Total Liters: {item.totalLiters ?? '—'}</Text>
              <Text style={styles.subtitle}>Cubic Meters: {item.cubicMeters ?? '—'}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}
