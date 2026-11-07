/* 首页图表基线 · 与项目 echarts@6.1.0 一致 */
(function () {
  const css = (n, fb) => (getComputedStyle(document.documentElement).getPropertyValue(n) || fb).trim();
  window.V5C = {
    c: (n, fb) => css('--' + n, fb),
    axisLabel: () => ({ color: css('--faint', '#8a9a92'), fontSize: 11, fontFamily: css('--mono', 'monospace') }),
    split: () => ({ lineStyle: { color: css('--border', '#e6ebe7'), width: 1, type: [4, 4] } }),
    tooltip: () => ({
      backgroundColor: css('--surface', '#fff'),
      borderColor: css('--border-strong', '#d8e2db'),
      borderWidth: 1,
      padding: [9, 12],
      textStyle: { color: css('--title', '#15241e'), fontSize: 12 },
      extraCssText: 'border-radius:10px;box-shadow:0 10px 24px rgba(20,40,30,.10);'
    })
  };
})();
