# Build with the same Ballerina version used locally and in CI, then run the jar once per tick.
FROM ballerina/ballerina:2201.14.2 AS build
COPY --chown=ballerina:ballerina . /home/ballerina/src
WORKDIR /home/ballerina/src
RUN bal build

FROM ballerina/ballerina:2201.14.2
COPY --from=build /home/ballerina/src/target/bin/labbook_scheduler.jar /home/ballerina/app.jar
CMD ["java", "-jar", "/home/ballerina/app.jar"]
