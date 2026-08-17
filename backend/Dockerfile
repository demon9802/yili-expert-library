FROM yldc-docker.pkg.coding.yili.com/pubrepo/pubdocker/java:openjdk8-ubuntu20.04
# tag: openjdk8  openjdk11  openjdk16  oraclejre8u201
MAINTAINER by coding
# ENV LANG en_US.UTF-8

# ---------------------只改此处，其它不动--------------------------
# 定义jar包文件名  当前目录 ./ 为代码根目录
# ARG JARFILE=./xxxx/xxx/target/xxxxx.jar
ARG JARFILE=./target/yili-expert-resource.jar
# --------------------------------------------------------------------

# 定义appName=k8s服务名，外部传参
ARG appName
ENV appName ${appName}
COPY --chown=ylapp   ${JARFILE}   /data/app/${appName}.jar

WORKDIR /data/app
USER ylapp
EXPOSE 8080
#CMD ["sh", "-ec", "exec java ${JAVA_OPTS} -Xshare:off -jar ${appName}.jar "]
CMD ["sh", "-ec", "exec java ${JAVA_OPTS} -Xshare:off -jar ${appName}.jar -XX:+UseParNewGC -XX:+UseConcMarkSweepGC -XX:+CMSParallelRemarkEnabled -XX:+CMSScavengeBeforeRemark -XX:+ExplicitGCInvokesConcurrent -XX:+CMSClassUnloadingEnabled -XX:+UseCMSCompactAtFullCollection -XX:CMSFullGCsBeforeCompaction=5 -XX:CMSInitiatingOccupancyFraction=75 -XX:+UseCMSInitiatingOccupancyOnly -XX:+UseCompressedOops -XX:StringTableSize=100013 -XX:+PrintGCDetails -XX:+PrintGCDateStamps -XX:+PrintGC -XX:+PrintTenuringDistribution -XX:+PrintStringTableStatistics -XX:+HeapDumpOnOutOfMemoryError -Xloggc:./${appName}/${appName}-gc.log -XX:HeapDumpPath=./${appName}/${appName}-heapdump.hprof"]